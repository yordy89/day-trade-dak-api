import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

export interface GlobalMessage<T = any> {
  id: string;
  type: string;
  timestamp: Date;
  version: number;
  targetRegions: string[];
  payload: T;
  metadata: {
    correlationId: string;
    sourceService: string;
    publishedBy?: string;
  };
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: any = null;
  private readonly logger = new Logger(RabbitMQService.name);
  private isConnected = false;
  private messageHandlers: Map<string, (message: GlobalMessage) => Promise<void>> = new Map();

  // Region code for this API instance
  private readonly regionCode = 'us';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Use process.env directly since RABBITMQ_URL is not in the configuration object
    const rabbitMqUrl = process.env.RABBITMQ_URL;
    if (rabbitMqUrl) {
      this.logger.log('RABBITMQ_URL found, initiating connection...');
      // Don't await - let connection happen in background to avoid blocking app startup
      this.connect().catch((err) => {
        this.logger.error(`RabbitMQ initial connection failed: ${err.message}`);
      });
    } else {
      this.logger.warn('RABBITMQ_URL not configured. Global sync disabled.');
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitMqUrl = process.env.RABBITMQ_URL;
      if (!rabbitMqUrl) {
        this.logger.error('RABBITMQ_URL not found in environment');
        return;
      }

      this.logger.log(`Connecting to RabbitMQ...`);

      // Add connection timeout to prevent indefinite blocking
      const connectionTimeout = 10000; // 10 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RabbitMQ connection timeout')), connectionTimeout);
      });

      this.connection = await Promise.race([
        amqplib.connect(rabbitMqUrl),
        timeoutPromise,
      ]);
      this.channel = await this.connection.createChannel();

      // Set up exchanges
      await this.channel.assertExchange('daytradedak.events', 'topic', { durable: true });
      await this.channel.assertExchange('daytradedak.courses', 'topic', { durable: true });
      await this.channel.assertExchange('daytradedak.registrations', 'topic', { durable: true });
      await this.channel.assertExchange('daytradedak.meetings', 'topic', { durable: true });

      // Set up queues for this region
      await this.setupQueue('us.events.queue', 'daytradedak.events', ['event.created', 'event.updated', 'event.cancelled', 'event.deleted']);
      await this.setupQueue('us.courses.queue', 'daytradedak.courses', ['course.published', 'course.updated', 'course.archived']);
      await this.setupQueue('us.registrations.queue', 'daytradedak.registrations', ['registration.created', 'registration.updated']);
      await this.setupQueue('us.meetings.queue', 'daytradedak.meetings', ['meeting.created', 'meeting.updated', 'meeting.cancelled', 'meeting.deleted']);

      this.isConnected = true;
      this.logger.log('Successfully connected to RabbitMQ and set up queues');

      // Handle connection errors
      this.connection.on('error', (err: Error) => {
        this.logger.error('RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async setupQueue(queueName: string, exchange: string, routingKeys: string[]): Promise<void> {
    await this.channel.assertQueue(queueName, { durable: true });

    for (const routingKey of routingKeys) {
      await this.channel.bindQueue(queueName, exchange, routingKey);
    }

    // Start consuming
    await this.channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          const message: GlobalMessage = content;

          this.logger.log(`Received message: type=${message.type}, targetRegions=${JSON.stringify(message.targetRegions)}`);

          // Check if this region should process this message
          if (this.shouldProcess(message.targetRegions)) {
            this.logger.log(`Processing message for region ${this.regionCode}`);
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              await handler(message);
            } else {
              this.logger.warn(`No handler registered for message type: ${message.type}`);
            }
          } else {
            this.logger.log(`Skipping message - not for region ${this.regionCode}`);
          }

          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message: ${error.message}`);
          // Reject and don't requeue to avoid infinite loop
          this.channel.nack(msg, false, false);
        }
      }
    });

    this.logger.log(`Queue '${queueName}' set up and consuming`);
  }

  private shouldProcess(targetRegions: string[]): boolean {
    return targetRegions.includes('all') || targetRegions.includes(this.regionCode);
  }

  registerHandler(messageType: string, handler: (message: GlobalMessage) => Promise<void>): void {
    this.messageHandlers.set(messageType, handler);
    this.logger.log(`Registered handler for message type: ${messageType}`);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
      this.logger.log('Disconnected from RabbitMQ');
    } catch (error: any) {
      this.logger.error(`Error disconnecting from RabbitMQ: ${error.message}`);
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  // Method to report sync status back to Global API
  async reportSyncStatus(
    globalId: string,
    resourceType: 'event' | 'course' | 'registration' | 'meeting',
    status: 'synced' | 'failed',
    localId?: string,
    error?: string,
  ): Promise<void> {
    // Use process.env directly since GLOBAL_API_URL is not in the configuration object
    const globalApiUrl = process.env.GLOBAL_API_URL;
    if (!globalApiUrl) {
      this.logger.warn('GLOBAL_API_URL not configured. Cannot report sync status.');
      return;
    }

    try {
      const axios = await import('axios');

      // Build request body based on resource type
      const body: any = {
        regionCode: this.regionCode,
        status,
        error,
      };

      // Use appropriate field name based on resource type
      if (resourceType === 'registration') {
        body.regionalRegistrationId = localId;
      } else {
        body.localId = localId;
      }

      await axios.default.patch(`${globalApiUrl}/api/v1/${resourceType}s/${globalId}/sync-status`, body);
      this.logger.log(`Reported sync status for ${resourceType} ${globalId}: ${status}`);
    } catch (err) {
      this.logger.error(`Failed to report sync status: ${err.message}`);
    }
  }
}
