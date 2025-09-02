import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('email-marketing/analytics')
@Controller('email-marketing/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get email marketing analytics' })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  @ApiQuery({ name: 'timeRange', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAnalytics(
    @Query('campaignId') campaignId?: string,
    @Query('timeRange') timeRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getAnalytics({
      campaignId,
      timeRange,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  @ApiQuery({ name: 'timeRange', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  async exportAnalytics(
    @Query('campaignId') campaignId: string,
    @Query('timeRange') timeRange: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.exportAnalytics(
      { campaignId, timeRange },
      format,
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
      res.send(data);
    } else {
      res.json(data);
    }
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get overall email marketing analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: RequestWithUser,
  ) {
    const analytics = await this.analyticsService.getAnalytics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return analytics;
  }

  @Get('campaigns/:campaignId')
  @ApiOperation({ summary: 'Get analytics for a specific campaign' })
  async getCampaignAnalytics(@Param('campaignId') campaignId: string) {
    return this.analyticsService.getCampaignAnalytics(campaignId);
  }

  @Post('track/:campaignId')
  @ApiOperation({ summary: 'Track email send for analytics' })
  async trackEmail(
    @Param('campaignId') campaignId: string,
    @Body() body: { recipientEmail: string },
  ) {
    return this.analyticsService.trackEmail(campaignId, body.recipientEmail);
  }

  @Post('webhook/brevo')
  @ApiOperation({ summary: 'Handle Brevo webhook events' })
  @HttpCode(HttpStatus.OK)
  async handleBrevoWebhook(@Body() body: any) {
    const { event, email, 'message-id': messageId, timestamp, ...data } = body;
    await this.analyticsService.handleBrevoWebhook(event, {
      messageId,
      email,
      timestamp,
      ...data,
    });
    return { success: true };
  }
}