// src/event-registrations/event-registrations.controller.ts

import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EventRegistrationsService } from './event-registration.service';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';

@Controller('event-registrations')
export class EventRegistrationsController {
  constructor(
    private readonly eventRegistrationsService: EventRegistrationsService,
  ) {}

  @Post()
  async create(@Body() createEventRegistrationDto: CreateEventRegistrationDto) {
    const { eventId, email } = createEventRegistrationDto;
    await this.eventRegistrationsService.validateNotRegistered(eventId, email);
    return this.eventRegistrationsService.create(createEventRegistrationDto);
  }

  @Get('event/:eventId')
  findByEvent(@Param('eventId') eventId: string) {
    return this.eventRegistrationsService.findByEvent(eventId);
  }
}
