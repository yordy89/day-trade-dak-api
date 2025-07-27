import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
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
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminService } from '../admin.service';

@ApiTags('admin/analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminService: AdminService,
  ) {}

  @Get('payment-stats')
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'currency', required: false, type: String })
  async getPaymentStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('currency') currency: string = 'USD',
    @Request() req?: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'payment_statistics',
      details: { startDate, endDate, currency },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminAnalyticsService.getPaymentStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      currency,
    });
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get payment transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'method', required: false, type: String })
  @ApiQuery({ name: 'plans', required: false, type: String })
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  async getPaymentTransactions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('plans') plans?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Request() req?: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'payment_transactions',
      details: { page, limit, startDate, endDate, search, status, method },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminAnalyticsService.getPaymentTransactions({
      page: page || 1,
      limit: limit || 25,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      status,
      method,
      plans,
      minAmount: minAmount !== undefined ? Number(minAmount) : undefined,
      maxAmount: maxAmount !== undefined ? Number(maxAmount) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('subscription-stats')
  @ApiOperation({ summary: 'Get subscription statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async getSubscriptionStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'subscription_statistics',
      details: { startDate, endDate },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminAnalyticsService.getSubscriptionStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics report' })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['revenue', 'transactions', 'subscriptions'],
  })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'pdf'] })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  async exportAnalyticsReport(
    @Query('type') type: 'revenue' | 'transactions' | 'subscriptions',
    @Query('format') format: 'csv' | 'pdf' = 'csv',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'export',
      resource: 'analytics_report',
      details: { type, format, startDate, endDate },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.adminAnalyticsService.exportReport({
      type,
      format,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }
}
