import {
  Controller,
  Get,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SubscriptionPlan as SubscriptionPlanSchema,
  SubscriptionPlanDocument,
} from 'src/subscriptions/subscription-plan.schema';

@ApiTags('public')
@Controller('public')
export class PublicPricingController {
  constructor(
    @InjectModel(SubscriptionPlanSchema.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
  ) {}

  @Get('subscription-plans')
  @ApiOperation({ summary: 'Get all active subscription plans (public)' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by plan type',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language (en/es)',
    enum: ['en', 'es'],
  })
  async getPublicSubscriptionPlans(
    @Query('type') type?: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ): Promise<any[]> {
    const query: any = { isActive: true };
    if (type) {
      query.type = type;
    }

    const plans = await this.subscriptionPlanModel
      .find(query)
      .sort({ 'uiMetadata.sortOrder': 1 })
      .exec();

    // Transform for public consumption
    return plans.map((plan) => ({
      planId: plan.planId,
      // Handle both old and new displayName formats
      displayName:
        typeof plan.displayName === 'string'
          ? plan.displayName
          : plan.displayName?.[lang] || plan.displayName?.en || '',
      // Handle both old and new description formats
      description:
        typeof plan.description === 'string'
          ? plan.description
          : plan.description?.[lang] || plan.description?.en || '',
      type: plan.type,
      pricing: plan.pricing
        ? {
            amount: plan.pricing.baseAmount,
            currency: plan.pricing.currency,
            interval: plan.pricing.interval,
            intervalCount: plan.pricing.intervalCount,
          }
        : {
            amount: plan.amount || 0,
            currency: plan.currency || 'usd',
            interval: plan.interval,
            intervalCount: plan.intervalCount || 1,
          },
      // Handle both old and new features formats
      features: Array.isArray(plan.features)
        ? plan.features
        : plan.features?.[lang] || plan.features?.en || [],
      uiMetadata: plan.uiMetadata || {
        color: '#000000',
        icon: 'Star',
        popular: plan.isPopular || false,
        sortOrder: plan.sortOrder || 0,
      },
      trialPeriodDays: plan.trialPeriodDays || 0,
      // Don't expose conditional pricing rules publicly
      hasConditionalPricing:
        plan.conditionalPricing && plan.conditionalPricing.length > 0,
    }));
  }

  @Get('subscription-plans/:planId')
  @ApiOperation({ summary: 'Get a specific subscription plan (public)' })
  @ApiParam({ name: 'planId', description: 'Plan ID' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language (en/es)',
    enum: ['en', 'es'],
  })
  async getPublicSubscriptionPlan(
    @Param('planId') planId: string,
    @Query('lang') lang: 'en' | 'es' = 'en',
  ): Promise<any> {
    const plan = await this.subscriptionPlanModel
      .findOne({ planId, isActive: true })
      .exec();

    if (!plan) {
      return null;
    }

    return {
      planId: plan.planId,
      // Handle both old and new displayName formats
      displayName:
        typeof plan.displayName === 'string'
          ? plan.displayName
          : plan.displayName?.[lang] || plan.displayName?.en || '',
      // Handle both old and new description formats
      description:
        typeof plan.description === 'string'
          ? plan.description
          : plan.description?.[lang] || plan.description?.en || '',
      type: plan.type,
      pricing: plan.pricing
        ? {
            amount: plan.pricing.baseAmount,
            currency: plan.pricing.currency,
            interval: plan.pricing.interval,
            intervalCount: plan.pricing.intervalCount,
          }
        : {
            amount: plan.amount || 0,
            currency: plan.currency || 'usd',
            interval: plan.interval,
            intervalCount: plan.intervalCount || 1,
          },
      // Handle both old and new features formats
      features: Array.isArray(plan.features)
        ? plan.features
        : plan.features?.[lang] || plan.features?.en || [],
      uiMetadata: plan.uiMetadata || {
        color: '#000000',
        icon: 'Star',
        popular: plan.isPopular || false,
        sortOrder: plan.sortOrder || 0,
      },
      trialPeriodDays: plan.trialPeriodDays || 0,
      hasConditionalPricing:
        plan.conditionalPricing && plan.conditionalPricing.length > 0,
    };
  }
}
