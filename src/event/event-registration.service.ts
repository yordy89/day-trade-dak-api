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
import { EmailService } from 'src/email/email.service';

@Injectable()
export class EventRegistrationsService {
  constructor(
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    private readonly emailService: EmailService,
  ) {}

  async create(createEventRegistrationDto: CreateEventRegistrationDto) {
    const { eventId, email, firstName } = createEventRegistrationDto;

    try {
      await this.validateNotRegistered(eventId, email); // ✅ New line

      const createdRegistration = new this.eventRegistrationModel({
        ...createEventRegistrationDto,
        email: email.toLowerCase(),
      });

      const saved = await createdRegistration.save();

      await this.emailService.sendEventRegistrationTemplate(
        email,
        firstName,
        2,
      );
      return saved;
    } catch (error) {
      throw new BadRequestException(error);
    }
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

  async findByEvent(eventId: string) {
    return this.eventRegistrationModel.find({ eventId }).exec();
  }
}
