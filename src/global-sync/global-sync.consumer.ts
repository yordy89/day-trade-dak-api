import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService, GlobalMessage } from './rabbitmq.service';
import { GlobalSyncService, EventPayload, RegistrationPayload } from './global-sync.service';
import { EventDocument } from '../event/schemas/event.schema';
import { EventRegistrationDocument } from '../event/schemas/eventRegistration.schema';

@Injectable()
export class GlobalSyncConsumer implements OnModuleInit {
  private readonly logger = new Logger(GlobalSyncConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly globalSyncService: GlobalSyncService,
  ) {}

  onModuleInit() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Event handlers
    this.rabbitMQService.registerHandler('event.created', this.handleEventCreated.bind(this));
    this.rabbitMQService.registerHandler('event.updated', this.handleEventUpdated.bind(this));
    this.rabbitMQService.registerHandler('event.cancelled', this.handleEventCancelled.bind(this));
    this.rabbitMQService.registerHandler('event.deleted', this.handleEventDeleted.bind(this));

    // Course handlers (placeholder for future implementation)
    this.rabbitMQService.registerHandler('course.published', this.handleCoursePublished.bind(this));
    this.rabbitMQService.registerHandler('course.updated', this.handleCourseUpdated.bind(this));
    this.rabbitMQService.registerHandler('course.archived', this.handleCourseArchived.bind(this));

    // Registration handlers
    this.rabbitMQService.registerHandler('registration.created', this.handleRegistrationCreated.bind(this));
    this.rabbitMQService.registerHandler('registration.updated', this.handleRegistrationUpdated.bind(this));

    this.logger.log('All message handlers registered');
  }

  // Event Handlers
  private async handleEventCreated(message: GlobalMessage<EventPayload>): Promise<void> {
    this.logger.log(`Handling event.created: ${message.payload.globalId}`);

    try {
      const event = await this.globalSyncService.createEventFromGlobal(
        message.payload,
        message.version,
      );

      // Report success back to Global API
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'synced',
        event._id?.toString(),
      );
    } catch (error) {
      this.logger.error(`Failed to create event from global: ${error.message}`);
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'failed',
        undefined,
        error.message,
      );
    }
  }

  private async handleEventUpdated(message: GlobalMessage<EventPayload>): Promise<void> {
    this.logger.log(`Handling event.updated: ${message.payload.globalId}`);

    try {
      const event = await this.globalSyncService.updateEventFromGlobal(
        message.payload.globalId,
        message.payload,
        message.version,
      );

      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'synced',
        event._id?.toString(),
      );
    } catch (error) {
      this.logger.error(`Failed to update event from global: ${error.message}`);
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'failed',
        undefined,
        error.message,
      );
    }
  }

  private async handleEventCancelled(message: GlobalMessage<EventPayload>): Promise<void> {
    this.logger.log(`Handling event.cancelled: ${message.payload.globalId}`);

    try {
      await this.globalSyncService.cancelEventFromGlobal(message.payload.globalId);

      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'synced',
      );
    } catch (error) {
      this.logger.error(`Failed to cancel event from global: ${error.message}`);
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalId,
        'event',
        'failed',
        undefined,
        error.message,
      );
    }
  }

  private async handleEventDeleted(message: GlobalMessage<{ globalId: string }>): Promise<void> {
    this.logger.log(`Handling event.deleted: ${message.payload.globalId}`);

    try {
      await this.globalSyncService.deleteEventFromGlobal(message.payload.globalId);
    } catch (error) {
      this.logger.error(`Failed to delete event from global: ${error.message}`);
    }
  }

  // Course Handlers (placeholders)
  private async handleCoursePublished(message: GlobalMessage): Promise<void> {
    this.logger.log(`Handling course.published: ${message.payload.globalId}`);
    // TODO: Implement course sync when course module is added
  }

  private async handleCourseUpdated(message: GlobalMessage): Promise<void> {
    this.logger.log(`Handling course.updated: ${message.payload.globalId}`);
    // TODO: Implement course sync
  }

  private async handleCourseArchived(message: GlobalMessage): Promise<void> {
    this.logger.log(`Handling course.archived: ${message.payload.globalId}`);
    // TODO: Implement course sync
  }

  // Registration Handlers
  private async handleRegistrationCreated(message: GlobalMessage<RegistrationPayload>): Promise<void> {
    this.logger.log(`Handling registration.created: ${message.payload.globalRegistrationId}`);

    try {
      const registration = await this.globalSyncService.createRegistrationFromGlobal(
        message.payload,
      );

      // Report success back to Global API
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalRegistrationId,
        'registration',
        'synced',
        registration._id?.toString(),
      );

      this.logger.log(
        `Successfully synced registration ${message.payload.globalRegistrationId} -> local ${registration._id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create registration from global: ${error.message}`);
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalRegistrationId,
        'registration',
        'failed',
        undefined,
        error.message,
      );
    }
  }

  private async handleRegistrationUpdated(message: GlobalMessage<RegistrationPayload>): Promise<void> {
    this.logger.log(`Handling registration.updated: ${message.payload.globalRegistrationId}`);

    try {
      const registration = await this.globalSyncService.updateRegistrationFromGlobal(
        message.payload.globalRegistrationId,
        message.payload,
      );

      if (registration) {
        await this.rabbitMQService.reportSyncStatus(
          message.payload.globalRegistrationId,
          'registration',
          'synced',
          registration._id?.toString(),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update registration from global: ${error.message}`);
      await this.rabbitMQService.reportSyncStatus(
        message.payload.globalRegistrationId,
        'registration',
        'failed',
        undefined,
        error.message,
      );
    }
  }
}
