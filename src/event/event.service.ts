import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './event.schema';
import { CreateEventDto, UpdateEventDto } from './event.dto';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  async findAll(): Promise<Event[]> {
    return this.eventModel.find().exec();
  }

  async findUserEvents(userId: string): Promise<Event[]> {
    return this.eventModel.find({ userId }).exec();
  }

  async createEvent(eventDto: CreateEventDto) {
    const { title, start, end, allDay, type, userId } = eventDto;

    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];
    const startTime = allDay ? undefined : start.split('T')[1]?.slice(0, 5);
    const endTime = allDay ? undefined : end.split('T')[1]?.slice(0, 5);

    const newEvent = new this.eventModel({
      title,
      start,
      end,
      startDate,
      endDate,
      startTime,
      endTime,
      allDay,
      type,
      userId,
    });

    return await newEvent.save();
  }

  async updateEvent(id: string, updateEventDto: UpdateEventDto) {
    const event = await this.eventModel.findById(id);
    if (!event) throw new NotFoundException('Event not found');

    Object.assign(event, updateEventDto);
    return event.save();
  }

  async remove(eventId: string): Promise<{ message: string }> {
    const deletedEvent = await this.eventModel.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
    return { message: 'Event successfully deleted' };
  }
}
