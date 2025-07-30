import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Response,
  BadRequestException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { AdminReportsService, ReportTemplate } from '../services/admin-reports.service';
import { AdminService } from '../admin.service';
import { RequestWithUser } from '../../types/request-with-user.interface';

@ApiTags('admin/reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminReportsController {
  constructor(
    private readonly reportsService: AdminReportsService,
    private readonly adminService: AdminService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate comprehensive business report' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
          description: 'Type of report to generate',
        },
        format: {
          type: 'string',
          enum: ['csv', 'excel', 'pdf'],
          description: 'Output format',
        },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date' },
            end: { type: 'string', format: 'date' },
          },
          description: 'Date range for the report',
        },
        includeCharts: {
          type: 'boolean',
          description: 'Include charts in PDF reports',
        },
      },
      required: ['type', 'format'],
    },
  })
  async generateReport(
    @Body() reportConfig: {
      type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
      format: 'csv' | 'excel' | 'pdf';
      dateRange?: { start: string; end: string };
      includeCharts?: boolean;
    },
    @Response() res: ExpressResponse,
    @Request() req: RequestWithUser,
  ) {
    try {
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user.userId,
        adminEmail: req.user.email,
        action: 'generate',
        resource: 'report',
        details: reportConfig,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Generate report
      const report = await this.reportsService.generateReport(reportConfig);

      // Set appropriate headers based on format
      const contentType = {
        csv: 'text/csv',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
      }[reportConfig.format];

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      res.setHeader('Content-Length', report.buffer.length.toString());
      
      // Send file buffer and end response
      res.end(report.buffer);
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(400).json({
        statusCode: 400,
        message: error.message || 'Failed to generate report',
        error: 'Bad Request',
      });
    }
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get available report templates' })
  async getReportTemplates(): Promise<ReportTemplate[]> {
    return this.reportsService.getReportTemplates();
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview report data without generating file' })
  @ApiQuery({ name: 'type', required: true })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async previewReport(
    @Query('type') type: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange = {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(endDate) : undefined,
    };

    return this.reportsService.getReportData(type, dateRange);
  }

  @Get('test-excel')
  @ApiOperation({ summary: 'Test Excel generation' })
  async testExcel(@Response() res: ExpressResponse) {
    try {
      const report = await this.reportsService.generateReport({
        type: 'daily',
        format: 'excel',
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="test-report.xlsx"`);
      res.setHeader('Content-Length', report.buffer.length.toString());
      
      res.end(report.buffer);
    } catch (error) {
      console.error('Test Excel generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}