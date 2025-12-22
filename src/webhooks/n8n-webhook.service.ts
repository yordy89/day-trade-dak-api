import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface UserRegistrationWebhookData {
  event: 'user.registered';
  timestamp: string;
  region: 'us' | 'es';
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  metadata?: {
    source?: string;
    referralCode?: string;
    acceptedMediaUsageTerms?: boolean;
    [key: string]: any;
  };
}

@Injectable()
export class N8nWebhookService {
  private readonly logger = new Logger(N8nWebhookService.name);
  private readonly webhookUrl: string | undefined;
  private readonly timeout: number;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    this.timeout =
      this.configService.get<number>('N8N_WEBHOOK_TIMEOUT') || 5000;
    this.enabled =
      this.configService.get<string>('N8N_WEBHOOK_ENABLED') !== 'false';

    if (this.webhookUrl) {
      this.logger.log(
        `n8n webhook configured: ${this.webhookUrl.substring(0, 50)}...`,
      );
    } else {
      this.logger.warn(
        'n8n webhook URL not configured - notifications disabled',
      );
    }
  }

  /**
   * Send user registration event to n8n
   * This method is fire-and-forget and will NEVER throw an error
   */
  notifyUserRegistration(data: UserRegistrationWebhookData): void {
    if (!this.enabled || !this.webhookUrl) {
      this.logger.debug('n8n webhook disabled or not configured, skipping');
      return;
    }

    // Fire-and-forget - don't await, don't block
    this.sendWebhook(data);
  }

  /**
   * Internal method to send webhook - handles all errors gracefully
   */
  private async sendWebhook(data: any): Promise<void> {
    try {
      const response = await axios.post(this.webhookUrl!, data, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'daytradedak-api',
        },
      });

      this.logger.debug(`n8n webhook sent successfully: ${response.status}`);
    } catch (error: any) {
      // Log but NEVER throw - this must not affect the registration
      if (error.code === 'ECONNABORTED') {
        this.logger.warn(`n8n webhook timeout after ${this.timeout}ms`);
      } else if (
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED'
      ) {
        this.logger.warn(`n8n webhook connection failed: ${error.code}`);
      } else {
        this.logger.warn(`n8n webhook failed: ${error.message}`);
      }
    }
  }
}
