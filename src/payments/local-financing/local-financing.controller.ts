import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LocalFinancingService } from './local-financing.service';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';

@Controller('v1/local-financing')
export class LocalFinancingController {
  constructor(private readonly localFinancingService: LocalFinancingService) {}

  /**
   * Check if user is eligible for local financing
   */
  @UseGuards(JwtAuthGuard)
  @Get('check-eligibility')
  async checkEligibility(
    @Req() req: any,
    @Query('amount') amount: string,
  ) {
    if (!amount || isNaN(Number(amount))) {
      throw new HttpException('Valid amount is required', HttpStatus.BAD_REQUEST);
    }

    return this.localFinancingService.checkEligibility(
      req.user._id.toString(),
      Number(amount),
    );
  }

  /**
   * Get available financing plans for an amount
   */
  @Get('available-plans')
  async getAvailablePlans(@Query('amount') amount?: string) {
    const amountNumber = amount ? Number(amount) : undefined;
    return this.localFinancingService.getAvailableFinancingPlans(amountNumber);
  }

  /**
   * Create an installment plan for event registration
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-event-plan')
  async createEventInstallmentPlan(
    @Req() req: any,
    @Body() body: {
      planId: string;
      totalAmount: number;
      eventId: string;
      eventName: string;
      eventRegistrationId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.localFinancingService.createInstallmentPlan({
      userId: req.user._id.toString(),
      planId: body.planId,
      totalAmount: body.totalAmount,
      productType: 'event',
      productName: body.eventName,
      eventId: body.eventId,
      eventRegistrationId: body.eventRegistrationId,
      metadata: body.metadata,
    });
  }

  /**
   * Create an installment plan for course purchase
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-course-plan')
  async createCourseInstallmentPlan(
    @Req() req: any,
    @Body() body: {
      planId: string;
      totalAmount: number;
      courseType: 'master_course' | 'classes' | 'other';
      courseName: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.localFinancingService.createInstallmentPlan({
      userId: req.user._id.toString(),
      planId: body.planId,
      totalAmount: body.totalAmount,
      productType: body.courseType,
      productName: body.courseName,
      metadata: body.metadata,
    });
  }

  /**
   * Get user's installment plans
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-plans')
  async getUserPlans(@Req() req: any) {
    return this.localFinancingService.getUserInstallmentPlans(
      req.user._id.toString(),
    );
  }

  /**
   * Get specific installment plan details
   */
  @UseGuards(JwtAuthGuard)
  @Get('plan/:id')
  async getPlanDetails(
    @Req() req: any,
    @Param('id') planId: string,
  ) {
    const plans = await this.localFinancingService.getUserInstallmentPlans(
      req.user._id.toString(),
    );
    
    const plan = plans.find(p => (p as any)._id.toString() === planId);
    
    if (!plan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }
    
    return plan;
  }
}