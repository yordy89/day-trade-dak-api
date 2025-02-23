import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './event.schema';
import { EventService } from './event.service';
import { EventController } from './event.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]), // Register Model
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService], // Make sure to export if needed in other modules
})
export class EventModule {}
