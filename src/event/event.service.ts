// src/events/events.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventDocument } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  create(createEventDto: CreateEventDto) {
    const createdEvent = new this.eventModel(createEventDto);
    return createdEvent.save();
  }

  findAll() {
    return this.eventModel.find().exec();
  }

  findOne(id: string) {
    return this.eventModel.findById(id).exec();
  }

  async findActiveCommunityEvent() {
    // Find the most recent active community event
    return this.eventModel.findOne({
      type: 'community_event',
      isActive: true,
      date: { $gte: new Date() } // Event date is in the future
    })
    .sort({ date: 1 }) // Get the nearest upcoming event
    .exec();
  }

  async findCommunityEventById(id: string) {
    return this.eventModel.findOne({
      _id: id,
      type: 'community_event'
    }).exec();
  }
}
