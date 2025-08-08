// src/event-registrations/event-registrations.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EventRegistrationsService } from './event-registration.service';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { EventsService } from './event.service';

@Controller('event-registrations')
export class EventRegistrationsController {
  constructor(
    private readonly eventRegistrationsService: EventRegistrationsService,
    private readonly eventService: EventsService,
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

  // Get registrations by user ID
  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    return this.eventRegistrationsService.findByUserId(userId);
  }

  // Get registrations by email for managing existing registrations
  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }

    // Get all registrations for this email
    const registrations =
      await this.eventRegistrationsService.findByEmail(email);

    if (!registrations || registrations.length === 0) {
      throw new HttpException(
        'No registrations found for this email',
        HttpStatus.NOT_FOUND,
      );
    }

    // Filter only active events and add additional info
    const activeRegistrations = await Promise.all(
      registrations.map(async (registration) => {
        const event = await this.eventService.findOne(
          registration.eventId.toString(),
        );
        const eventDate = new Date(event.date);
        const now = new Date();
        const canAddAttendees = eventDate > now && event.isActive;

        return {
          _id: registration._id,
          event: {
            _id: event._id,
            name: event.name,
            title: event.title || event.name,
            date: event.date,
            type: event.type || 'general',
          },
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          additionalInfo: registration.additionalInfo || {},
          amountPaid: registration.amountPaid || 0,
          canAddAttendees,
        };
      }),
    );

    // Filter only community events where attendees can be added
    const filteredRegistrations = activeRegistrations.filter(
      (reg) => reg.event.type === 'community_event' && reg.canAddAttendees,
    );

    return { registrations: filteredRegistrations };
  }

  // Add attendees to existing registration
  @Post(':id/add-attendees')
  async addAttendees(
    @Param('id') registrationId: string,
    @Body()
    body: {
      additionalAdults: number;
      additionalChildren: number;
      paymentMethod: 'card' | 'klarna';
    },
  ) {
    // Validate input
    if (body.additionalAdults < 0 || body.additionalChildren < 0) {
      throw new HttpException(
        'Cannot reduce attendee count',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.additionalAdults === 0 && body.additionalChildren === 0) {
      throw new HttpException(
        'Must add at least one attendee',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get registration
    const registration =
      await this.eventRegistrationsService.findById(registrationId);
    if (!registration) {
      throw new HttpException('Registration not found', HttpStatus.NOT_FOUND);
    }

    // Verify event is still active and not past
    const event = await this.eventService.findOne(
      registration.eventId.toString(),
    );
    const eventDate = new Date(event.date);
    const now = new Date();

    if (eventDate <= now) {
      throw new HttpException(
        'Cannot add attendees to past events',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!event.isActive) {
      throw new HttpException(
        'Event is no longer active',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Calculate additional payment
    const ADULT_PRICE = 75;
    const CHILD_PRICE = 48;
    const baseAmount =
      body.additionalAdults * ADULT_PRICE +
      body.additionalChildren * CHILD_PRICE;

    // Create checkout session for additional payment
    // This will be handled by the Stripe service
    return this.eventRegistrationsService.createAdditionalAttendeesCheckout(
      registrationId,
      body.additionalAdults,
      body.additionalChildren,
      body.paymentMethod,
      baseAmount,
    );
  }
}
