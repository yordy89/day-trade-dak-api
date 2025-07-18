import { Controller, Get, Post, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './subscription-plan.schema';
import { PricingService, CalculatedPrice } from '../payments/stripe/pricing.service';
import { RequestWithUser } from '../auth/auth.interfaces';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly pricingService: PricingService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all active subscription plans' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by plan type' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language for display texts (en/es)', enum: ['en', 'es'] })
  async getSubscriptionPlans(
    @Query('type') type?: string,
    @Query('lang') lang: 'en' | 'es' = 'en'
  ): Promise<any[]> {
    const plans = await this.subscriptionsService.findAllPlans(type);
    
    // Transform plans to include language-specific fields
    return plans.map(plan => ({
      planId: plan.planId,
      // Handle both old and new displayName formats
      displayName: typeof plan.displayName === 'string' 
        ? plan.displayName 
        : (plan.displayName?.[lang] || plan.displayName?.en || ''),
      // Handle both old and new description formats
      description: typeof plan.description === 'string'
        ? plan.description
        : (plan.description?.[lang] || plan.description?.en || ''),
      type: plan.type,
      // Handle both old and new pricing formats
      pricing: plan.pricing || {
        baseAmount: plan.amount || 0,
        currency: plan.currency || 'usd',
        interval: plan.interval,
        intervalCount: plan.intervalCount || 1
      },
      // Handle both old and new features formats
      features: Array.isArray(plan.features) 
        ? plan.features 
        : (plan.features?.[lang] || plan.features?.en || []),
      uiMetadata: plan.uiMetadata || {
        color: '#000000',
        icon: 'Star',
        popular: plan.isPopular || false,
        sortOrder: plan.sortOrder || 0
      },
      meetingPermissions: plan.meetingPermissions,
      isActive: plan.isActive,
      trialPeriodDays: plan.trialPeriodDays || 0,
    }));
  }

  @Get('plans/with-pricing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription plans with user-specific pricing' })
  async getPlansWithPricing(@Req() req: RequestWithUser): Promise<{
    plans: any[];
    pricing: CalculatedPrice[];
  }> {
    const userId = req.user.sub;
    const plans = await this.subscriptionsService.findAllPlans();
    const pricing = await this.pricingService.calculatePricesForAllPlans(userId);
    
    return { plans, pricing };
  }

  @Get('plans/:planId')
  @ApiOperation({ summary: 'Get a specific subscription plan' })
  async getSubscriptionPlan(@Param('planId') planId: string): Promise<SubscriptionPlan> {
    return this.subscriptionsService.findPlanById(planId);
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a subscription plan (Super Admin only)' })
  async createOrUpdatePlan(@Body() planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    return this.subscriptionsService.createOrUpdatePlan(planData);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user active subscriptions' })
  async getUserSubscriptions(@Param('userId') userId: string): Promise<any[]> {
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  @Get('user/:userId/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user meeting permissions based on subscriptions' })
  async getUserMeetingPermissions(@Param('userId') userId: string): Promise<any> {
    return this.subscriptionsService.getUserMeetingPermissions(userId);
  }

  @Post('initialize-defaults')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize default subscription plans (Super Admin only)' })
  async initializeDefaults(): Promise<{ message: string }> {
    await this.subscriptionsService.initializeDefaultPlans();
    return { message: 'Default subscription plans initialized' };
  }
}