import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Response,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { AdminTransactionsService } from '../services/admin-transactions.service';
import { AdminService } from '../admin.service';
import { RequestWithUser } from '../../types/request-with-user.interface';

@ApiTags('admin/transactions')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: AdminTransactionsService,
    private readonly adminService: AdminService,
  ) {}

  @Get(':transactionId')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiParam({ name: 'transactionId', type: String })
  async getTransactionDetails(
    @Param('transactionId') transactionId: string,
    @Request() req: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'transaction_details',
      resourceId: transactionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.transactionsService.getTransactionDetails(transactionId);
  }

  @Get(':transactionId/invoice')
  @ApiOperation({ summary: 'Generate invoice for transaction' })
  @ApiParam({ name: 'transactionId', type: String })
  async generateInvoice(
    @Param('transactionId') transactionId: string,
    @Response() res: ExpressResponse,
    @Request() req: RequestWithUser,
  ) {
    try {
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user.userId,
        adminEmail: req.user.email,
        action: 'generate',
        resource: 'invoice',
        resourceId: transactionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const invoice = await this.transactionsService.generateInvoice(transactionId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.filename}"`);
      res.setHeader('Content-Length', invoice.buffer.length.toString());
      
      res.end(invoice.buffer);
    } catch (error) {
      console.error('Invoice generation error:', error);
      res.status(400).json({
        statusCode: 400,
        message: error.message || 'Failed to generate invoice',
        error: 'Bad Request',
      });
    }
  }

  @Post(':transactionId/refund')
  @ApiOperation({ summary: 'Process refund for transaction' })
  @ApiParam({ name: 'transactionId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to refund' },
        reason: { type: 'string', description: 'Reason for refund' },
      },
      required: ['amount', 'reason'],
    },
  })
  async processRefund(
    @Param('transactionId') transactionId: string,
    @Body() refundData: { amount: number; reason: string },
    @Request() req: RequestWithUser,
  ) {
    if (!refundData.amount || refundData.amount <= 0) {
      throw new BadRequestException('Invalid refund amount');
    }

    if (!refundData.reason) {
      throw new BadRequestException('Refund reason is required');
    }

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'refund',
      resource: 'transaction',
      resourceId: transactionId,
      details: refundData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return this.transactionsService.processRefund(
      transactionId,
      refundData.amount,
      refundData.reason,
    );
  }
}