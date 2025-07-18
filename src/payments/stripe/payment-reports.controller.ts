import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { PaymentAnalyticsService } from './payment-analytics.service';
import { SubscriptionPlan } from 'src/users/user.dto';
import { Role } from 'src/constants';

@ApiTags('Payment Reports')
@Controller('payments/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentReportsController {
  constructor(private readonly analyticsService: PaymentAnalyticsService) {}

  @Get('metrics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get payment metrics for a date range' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    example: '2025-01-31',
  })
  async getPaymentMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getPaymentMetrics(start, end);
  }

  @Get('subscriptions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get subscription metrics for a date range' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getSubscriptionMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getSubscriptionMetrics(start, end);
  }

  @Get('revenue-by-plan')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get revenue breakdown by subscription plan' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getRevenueByPlan(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getRevenueByPlan(start, end);
  }

  @Get('payment-methods')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get payment method distribution' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getPaymentMethodDistribution(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getPaymentMethodDistribution(start, end);
  }

  @Get('daily-revenue')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get daily revenue trend' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getDailyRevenueTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getDailyRevenueTrend(start, end);
  }

  @Get('customer-lifetime-value')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get customer lifetime value analytics' })
  @ApiQuery({ name: 'plan', required: false, enum: SubscriptionPlan })
  async getCustomerLifetimeValue(@Query('plan') plan?: SubscriptionPlan) {
    return this.analyticsService.getCustomerLifetimeValue(plan);
  }

  @Get('failed-payments')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get failed payment analytics' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getFailedPaymentReasons(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getFailedPaymentReasons(start, end);
  }

  @Get('refunds')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get refund analytics' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getRefundAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getRefundAnalytics(start, end);
  }

  @Get('events')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get event revenue analytics' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({
    name: 'eventType',
    required: false,
    type: String,
    enum: ['master_course', 'community_event', 'general'],
  })
  async getEventAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('eventType') eventType?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getEventAnalytics(start, end, eventType);
  }

  @Get('events/:eventId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get specific event financial metrics' })
  @ApiParam({ name: 'eventId', required: true, type: String })
  async getEventMetrics(@Param('eventId') eventId: string) {
    return this.analyticsService.getEventMetrics(eventId);
  }

  @Get('comprehensive-report')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Generate comprehensive payment report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async generateComprehensiveReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.generatePaymentReport(start, end);
  }

  @Get('monthly-summary')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get monthly payment summary' })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 1 })
  async getMonthlySummary(
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.analyticsService.generatePaymentReport(startDate, endDate);
  }

  @Get('quarterly-summary')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get quarterly payment summary' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({
    name: 'quarter',
    required: true,
    type: Number,
    description: 'Quarter (1-4)',
  })
  async getQuarterlySummary(
    @Query('year') year: number,
    @Query('quarter') quarter: number,
  ) {
    if (quarter < 1 || quarter > 4) {
      throw new BadRequestException('Quarter must be between 1 and 4');
    }

    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);

    return this.analyticsService.generatePaymentReport(startDate, endDate);
  }

  @Get('yearly-summary')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get yearly payment summary' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  async getYearlySummary(@Query('year') year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    return this.analyticsService.generatePaymentReport(startDate, endDate);
  }

  @Post('generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Generate custom payment report' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] },
        format: { type: 'string', enum: ['pdf', 'csv', 'excel'] },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date' },
            end: { type: 'string', format: 'date' }
          }
        },
        includeCharts: { type: 'boolean' }
      }
    }
  })
  async generateReport(@Body() reportConfig: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    format: 'pdf' | 'csv' | 'excel';
    dateRange?: { start: string; end: string };
    includeCharts?: boolean;
  }) {
    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    switch (reportConfig.type) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (!reportConfig.dateRange) {
          throw new BadRequestException('Date range required for custom reports');
        }
        startDate = new Date(reportConfig.dateRange.start);
        endDate = new Date(reportConfig.dateRange.end);
        break;
    }

    const reportData = await this.analyticsService.generatePaymentReport(startDate, endDate);
    
    // TODO: Format report based on requested format (PDF, CSV, Excel)
    // For now, return raw data
    return {
      type: reportConfig.type,
      format: reportConfig.format,
      dateRange: { start: startDate, end: endDate },
      data: reportData,
      generatedAt: new Date()
    };
  }
}
