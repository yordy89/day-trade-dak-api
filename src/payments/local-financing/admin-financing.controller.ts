import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../constants';
import { AdminFinancingService } from './admin-financing.service';

@Controller('v1/admin/financing')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.SUPER_ADMIN)
export class AdminFinancingController {
  constructor(private readonly adminFinancingService: AdminFinancingService) {}

  // ========== FINANCING PLANS MANAGEMENT ==========

  /**
   * Get all financing plans
   */
  @Get('plans')
  async getAllFinancingPlans(@Query('active') active?: string) {
    return this.adminFinancingService.getAllFinancingPlans(active);
  }

  /**
   * Get single financing plan
   */
  @Get('plans/:id')
  async getFinancingPlan(@Param('id') id: string) {
    return this.adminFinancingService.getFinancingPlan(id);
  }

  /**
   * Create new financing plan
   */
  @Post('plans')
  async createFinancingPlan(
    @Body() body: {
      planId: string;
      name: string;
      nameEN: string;
      description: string;
      descriptionEN: string;
      numberOfPayments: number;
      frequency: 'weekly' | 'biweekly' | 'monthly';
      minAmount: number;
      maxAmount: number;
      downPaymentPercent?: number;
      processingFeePercent?: number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.adminFinancingService.createFinancingPlan(body);
  }

  /**
   * Update financing plan
   */
  @Put('plans/:id')
  async updateFinancingPlan(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      nameEN: string;
      description: string;
      descriptionEN: string;
      numberOfPayments: number;
      frequency: string;
      minAmount: number;
      maxAmount: number;
      downPaymentPercent: number;
      processingFeePercent: number;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return this.adminFinancingService.updateFinancingPlan(id, body);
  }

  /**
   * Delete financing plan (soft delete - just deactivate)
   */
  @Delete('plans/:id')
  async deleteFinancingPlan(@Param('id') id: string) {
    return this.adminFinancingService.deleteFinancingPlan(id);
  }

  // ========== USER FINANCING APPROVAL ==========

  /**
   * Get users with financing approval status
   */
  @Get('users')
  async getUsersWithFinancingStatus(
    @Query('approved') approved?: string,
    @Query('search') search?: string,
  ) {
    return this.adminFinancingService.getUsersWithFinancingStatus(approved, search);
  }

  /**
   * Approve user for local financing
   */
  @Post('users/:userId/approve')
  async approveUserForFinancing(
    @Param('userId') userId: string,
    @Body() body: {
      maxAmount: number;
      notes?: string;
    },
    @Req() req: any,
  ) {
    return this.adminFinancingService.approveUserForFinancing(
      userId,
      body,
      req.user.email,
    );
  }

  /**
   * Revoke user's financing approval
   */
  @Post('users/:userId/revoke')
  async revokeUserFinancing(
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.adminFinancingService.revokeUserFinancing(
      userId,
      body.reason,
      req.user.email,
    );
  }

  /**
   * Update user's financing details
   */
  @Put('users/:userId/financing-details')
  async updateUserFinancingDetails(
    @Param('userId') userId: string,
    @Body() body: {
      maxAmount?: number;
      notes?: string;
    },
  ) {
    return this.adminFinancingService.updateUserFinancingDetails(userId, body);
  }

  // ========== INSTALLMENT PLANS MONITORING ==========

  /**
   * Get all installment plans with filters
   */
  @Get('installment-plans')
  async getAllInstallmentPlans(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('productType') productType?: string,
  ) {
    return this.adminFinancingService.getAllInstallmentPlans(status, userId, productType);
  }

  /**
   * Get installment plan details
   */
  @Get('installment-plans/:id')
  async getInstallmentPlanDetails(@Param('id') id: string) {
    return this.adminFinancingService.getInstallmentPlanDetails(id);
  }

  /**
   * Cancel an installment plan
   */
  @Post('installment-plans/:id/cancel')
  async cancelInstallmentPlan(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.adminFinancingService.cancelInstallmentPlan(
      id,
      body.reason,
      req.user.email,
    );
  }

  /**
   * Get financing analytics
   */
  @Get('analytics')
  async getFinancingAnalytics() {
    return this.adminFinancingService.getFinancingAnalytics();
  }
}