import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { AdminEventsService } from '../services/admin-events.service';
import { CreateAdminEventDto } from '../dto/create-admin-event.dto';
import { UpdateAdminEventDto } from '../dto/update-admin-event.dto';
import { EventFiltersDto } from '../dto/event-filters.dto';
import { ExportRegistrationsDto } from '../dto/export-registrations.dto';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminService } from '../admin.service';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminEventsController {
  constructor(
    private readonly adminEventsService: AdminEventsService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async getEvents(
    @Query() filters: EventFiltersDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminEventsService.findAllWithFilters(filters);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_EVENTS',
        resource: 'events',
        details: { filters },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return result;
    } catch (error) {
      throw new BadRequestException('Failed to fetch events');
    }
  }

  @Get('stats')
  async getEventStats(@Req() req: RequestWithUser) {
    try {
      const stats = await this.adminEventsService.getEventStatistics();
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_EVENT_STATS',
        resource: 'events',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return stats;
    } catch (error) {
      throw new BadRequestException('Failed to fetch event statistics');
    }
  }

  @Get(':id')
  async getEvent(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const event = await this.adminEventsService.findOneWithStats(id);
      
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_EVENT_DETAILS',
        resource: 'events',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return event;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch event details');
    }
  }

  @Post()
  async createEvent(
    @Body() createEventDto: CreateAdminEventDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      const event = await this.adminEventsService.create(createEventDto);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'CREATE_EVENT',
        resource: 'events',
        resourceId: event._id.toString(),
        details: { eventName: event.name },
        newValue: createEventDto,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Event created successfully',
        event,
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to create event');
    }
  }

  @Patch(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateAdminEventDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      const event = await this.adminEventsService.update(id, updateEventDto);
      
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'UPDATE_EVENT',
        resource: 'events',
        resourceId: id,
        newValue: updateEventDto,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Event updated successfully',
        event,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update event');
    }
  }

  @Delete(':id')
  async deleteEvent(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminEventsService.softDelete(id);
      
      if (!result) {
        throw new NotFoundException('Event not found');
      }

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'DELETE_EVENT',
        resource: 'events',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Event deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete event');
    }
  }

  @Get(':id/registrations')
  async getEventRegistrations(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('search') search?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    try {
      const result = await this.adminEventsService.getEventRegistrations(
        id,
        { page, limit, search, paymentStatus },
      );

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_EVENT_REGISTRATIONS',
        resource: 'events',
        resourceId: id,
        details: { filters: { search, paymentStatus } },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return result;
    } catch (error) {
      throw new BadRequestException('Failed to fetch event registrations');
    }
  }

  @Post(':id/export-registrations')
  async exportRegistrations(
    @Param('id') id: string,
    @Body() exportDto: ExportRegistrationsDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const { format, filters } = exportDto;
      
      // Get event and registrations
      const event = await this.adminEventsService.findOne(id);
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      const registrations = await this.adminEventsService.getRegistrationsForExport(
        id,
        filters,
      );

      // Generate export based on format
      let fileContent: Buffer;
      let contentType: string;
      let fileName: string;

      switch (format) {
        case 'csv':
          fileContent = await this.adminEventsService.generateCSV(registrations, event);
          contentType = 'text/csv';
          fileName = `${event.name}-registrations-${Date.now()}.csv`;
          break;
        case 'excel':
          fileContent = await this.adminEventsService.generateExcel(registrations, event);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileName = `${event.name}-registrations-${Date.now()}.xlsx`;
          break;
        case 'pdf':
          fileContent = await this.adminEventsService.generatePDF(registrations, event);
          contentType = 'application/pdf';
          fileName = `${event.name}-registrations-${Date.now()}.pdf`;
          break;
        default:
          throw new BadRequestException('Invalid export format');
      }

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'EXPORT_EVENT_REGISTRATIONS',
        resource: 'events',
        resourceId: id,
        details: { format, registrationCount: registrations.length },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      // Set response headers and send file
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileContent.length.toString(),
      });

      res.status(HttpStatus.OK).send(fileContent);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to export registrations');
    }
  }

  @Patch(':id/toggle-status')
  async toggleEventStatus(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const event = await this.adminEventsService.toggleStatus(id);
      
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'TOGGLE_EVENT_STATUS',
        resource: 'events',
        resourceId: id,
        details: { newStatus: event.isActive },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: `Event ${event.isActive ? 'activated' : 'deactivated'} successfully`,
        event,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to toggle event status');
    }
  }
}