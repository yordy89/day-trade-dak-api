import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Put,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto } from './event.dto';

@Controller('calendar')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  getAllEvents() {
    return this.eventService.findAll();
  }

  @Post()
  createEvent(@Body() eventDto: CreateEventDto) {
    return this.eventService.createEvent(eventDto);
  }

  @Put(':id')
  updateEvent(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.updateEvent(id, updateEventDto);
  }

  @Delete(':id')
  deleteEvent(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}
