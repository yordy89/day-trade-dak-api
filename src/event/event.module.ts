import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from './schemas/eventRegistration.schema';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';
import { EventRegistrationsController } from './event-registration.controller';
import { EventRegistrationsService } from './event-registration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema }, // 👉 Add second schema here
    ]),
  ],
  controllers: [EventsController, EventRegistrationsController],
  providers: [EventsService, EventRegistrationsService],
  exports: [EventsService, EventRegistrationsService],
})
export class EventModule {}
