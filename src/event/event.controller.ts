// src/events/events.controller.ts

import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { EventsServiceOptimized } from './event.service.optimized';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(
    @Inject('EventsService')
    private readonly eventsService: EventsServiceOptimized,
  ) {}

  @Post('')
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }
}
