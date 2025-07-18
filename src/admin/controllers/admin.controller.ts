import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from '../admin.service';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Get('users/stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  async getUserStatistics(@Request() req: RequestWithUser) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'user_statistics',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminService.getUserStatistics();
  }

  @Get('subscriptions/stats')
  @ApiOperation({ summary: 'Get subscription statistics' })
  @ApiResponse({ status: 200, description: 'Subscription statistics retrieved successfully' })
  async getSubscriptionStatistics(@Request() req: RequestWithUser) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'subscription_statistics',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminService.getSubscriptionStatistics();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get admin activity logs' })
  @ApiResponse({ status: 200, description: 'Admin logs retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'adminId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getAdminLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    const options = {
      page: page || 1,
      limit: limit || 50,
      adminId,
      action,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    };

    return this.adminService.getAdminLogs(options);
  }

  @Get('activity/:adminId')
  @ApiOperation({ summary: 'Get admin activity summary' })
  @ApiResponse({ status: 200, description: 'Admin activity summary retrieved successfully' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getAdminActivitySummary(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
    @Query('days') days?: number,
  ) {
    // Only super admins can view other admin's activity
    if (req.user.role !== Role.SUPER_ADMIN && req.user.userId !== adminId) {
      this.logger.warn(`Admin ${req.user.email} attempted to view activity of admin ${adminId}`);
      await this.adminService.logAdminAction({
        adminId: req.user.userId,
        adminEmail: req.user.email,
        action: 'view',
        resource: 'admin_activity',
        resourceId: adminId,
        status: 'failure',
        errorMessage: 'Unauthorized access attempt',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      throw new Error('You can only view your own activity summary');
    }

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'admin_activity',
      resourceId: adminId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminService.getAdminActivitySummary(adminId, days || 30);
  }
}