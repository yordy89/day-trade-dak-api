// src/event-registrations/event-registrations.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EventRegistration,
  EventRegistrationDocument,
} from './schemas/eventRegistration.schema';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';

import { BadRequestException } from '@nestjs/common';

@Injectable()
export class EventRegistrationsService {
  constructor(
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
  ) {}

  async create(createEventRegistrationDto: CreateEventRegistrationDto) {
    const { eventId, email } = createEventRegistrationDto;

    await this.validateNotRegistered(eventId, email); // ✅ New line

    const createdRegistration = new this.eventRegistrationModel({
      ...createEventRegistrationDto,
      email: email.toLowerCase(),
    });

    return createdRegistration.save();
  }

  async validateNotRegistered(eventId: string, email: string) {
    const existing = await this.eventRegistrationModel.findOne({
      eventId,
      email: email.toLowerCase(),
    });

    if (existing) {
      throw new BadRequestException(
        'Ya te has registrado con este correo electrónico.',
      );
    }
  }

  findByEvent(eventId: string) {
    return this.eventRegistrationModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .exec();
  }
}
