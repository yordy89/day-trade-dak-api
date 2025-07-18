import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from './schemas/eventRegistration.schema';
import { EventsServiceOptimized } from './event.service.optimized';
import { EventsController } from './event.controller';
import { EventRegistrationsController } from './event-registration.controller';
import { EventRegistrationsService } from './event-registration.service';
import { EmailModule } from 'src/email/email.module';
import { CacheModule } from 'src/cache/cache.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
    ]),
    EmailModule,
    CacheModule,
    LoggerModule,
  ],
  controllers: [EventsController, EventRegistrationsController],
  providers: [
    {
      provide: 'EventsService',
      useClass: EventsServiceOptimized,
    },
    EventsServiceOptimized,
    EventRegistrationsService,
  ],
  exports: ['EventsService', EventsServiceOptimized, EventRegistrationsService],
})
export class EventModule {}
