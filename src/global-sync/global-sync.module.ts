import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalSyncService } from './global-sync.service';
import { GlobalSyncConsumer } from './global-sync.consumer';
import { RabbitMQService } from './rabbitmq.service';
import { Event, EventSchema } from '../event/schemas/event.schema';
import { EventRegistration, EventRegistrationSchema } from '../event/schemas/eventRegistration.schema';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    EmailModule,
  ],
  providers: [GlobalSyncService, GlobalSyncConsumer, RabbitMQService],
  exports: [GlobalSyncService, RabbitMQService],
})
export class GlobalSyncModule {}
