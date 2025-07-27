import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminMeetingsService } from '../services/admin-meetings.service';
import { AdminService } from '../admin.service';
import { CreateMeetingDto } from '../dto/create-meeting.dto';
import { UpdateMeetingDto } from '../dto/update-meeting.dto';

@ApiTags('admin/meetings')
@Controller('admin/meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminMeetingsController {
  constructor(
    private readonly adminMeetingsService: AdminMeetingsService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get meetings with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'host', required: false, type: String })
  @ApiQuery({ name: 'dateRange', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  async getMeetings(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('host') host?: string,
    @Query('dateRange') dateRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Request() req?: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'view',
      resource: 'meetings',
      details: { page, limit, search, status, type, host, dateRange },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminMeetingsService.getMeetings({
      page: page || 1,
      limit: limit || 25,
      search,
      status,
      type,
      host,
      dateRange,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get meeting statistics' })
  async getMeetingStats(@Request() req: RequestWithUser) {
    return this.adminMeetingsService.getMeetingStats();
  }

  @Get(':meetingId')
  @ApiOperation({ summary: 'Get meeting by ID' })
  async getMeetingById(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'view',
      resource: 'meeting',
      resourceId: meetingId,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminMeetingsService.getMeetingById(meetingId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new meeting' })
  async createMeeting(
    @Body() createMeetingDto: CreateMeetingDto,
    @Request() req: RequestWithUser,
  ) {
    const meeting = await this.adminMeetingsService.createMeeting(
      createMeetingDto,
      createMeetingDto.hostId,
    );

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'create',
      resource: 'meeting',
      resourceId: meeting._id.toString(),
      newValue: { title: meeting.title, scheduledAt: meeting.scheduledAt },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return meeting;
  }

  @Patch(':meetingId')
  @ApiOperation({ summary: 'Update meeting' })
  async updateMeeting(
    @Param('meetingId') meetingId: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
    @Request() req: RequestWithUser,
  ) {
    const previousMeeting =
      await this.adminMeetingsService.getMeetingById(meetingId);
    const updatedMeeting = await this.adminMeetingsService.updateMeeting(
      meetingId,
      updateMeetingDto,
    );

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'update',
      resource: 'meeting',
      resourceId: meetingId,
      previousValue: previousMeeting,
      newValue: updatedMeeting,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return updatedMeeting;
  }

  @Delete(':meetingId')
  @ApiOperation({ summary: 'Delete meeting' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const meeting = await this.adminMeetingsService.getMeetingById(meetingId);
    await this.adminMeetingsService.deleteMeeting(meetingId);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'delete',
      resource: 'meeting',
      resourceId: meetingId,
      previousValue: { title: meeting.title, scheduledAt: meeting.scheduledAt },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':meetingId/start')
  @ApiOperation({ summary: 'Start a meeting' })
  async startMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const meeting = await this.adminMeetingsService.startMeeting(meetingId);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'start',
      resource: 'meeting',
      resourceId: meetingId,
      details: { status: 'live' },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return meeting;
  }

  @Post(':meetingId/end')
  @ApiOperation({ summary: 'End a meeting' })
  async endMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const meeting = await this.adminMeetingsService.endMeeting(meetingId);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'end',
      resource: 'meeting',
      resourceId: meetingId,
      details: { status: 'completed' },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return meeting;
  }

  @Post('daily/update-schedule')
  @ApiOperation({ summary: 'Manually update daily meeting schedule' })
  async updateDailyMeetingSchedule(@Request() req: RequestWithUser) {
    const meeting =
      await this.adminMeetingsService.updateDailyMeetingSchedule();

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'update',
      resource: 'daily-meeting-schedule',
      resourceId: meeting._id.toString(),
      details: { scheduledAt: meeting.scheduledAt },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return meeting;
  }

  @Post('cron/trigger-cleanup')
  @ApiOperation({
    summary: 'Manually trigger the daily meeting cleanup and creation cron job',
  })
  async triggerDailyCleanup(@Request() req: RequestWithUser) {
    // This endpoint will trigger the cron job manually for testing
    const result = await this.adminMeetingsService.triggerDailyCleanup();

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'trigger',
      resource: 'daily-meeting-cleanup',
      resourceId: 'cron-job',
      details: result,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'Daily cleanup and creation cron job triggered successfully',
      result,
    };
  }
}
