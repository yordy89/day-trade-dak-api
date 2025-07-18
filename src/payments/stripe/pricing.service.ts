import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from 'src/users/users.service';
import { SubscriptionPlan } from 'src/users/user.dto';
import { 
  SubscriptionPlan as SubscriptionPlanSchema, 
  SubscriptionPlanDocument,
  ConditionalPricingRule 
} from 'src/subscriptions/subscription-plan.schema';

export interface PricingRule {
  plan: SubscriptionPlan;
  basePrice: number;
  currency: string;
  conditions?: {
    requiredPlan?: SubscriptionPlan[];
    discountAmount?: number;
    discountPercentage?: number;
    freeWithPlan?: SubscriptionPlan[];
  };
}

export interface CalculatedPrice {
  plan: SubscriptionPlan;
  originalPrice: number;
  finalPrice: number;
  discount: number;
  discountReason?: string;
  currency: string;
  isFree: boolean;
}

@Injectable()
export class PricingService implements OnModuleInit {
  private logger = new Logger(PricingService.name);
  private pricingRules: Map<SubscriptionPlan, PricingRule> = new Map();
  private planCache: Map<string, SubscriptionPlanDocument> = new Map();
  private cacheExpiryTime = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @InjectModel(SubscriptionPlanSchema.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
  ) {}

  async onModuleInit() {
    await this.loadPricingRules();
  }

  private async loadPricingRules() {
    try {
      const plans = await this.subscriptionPlanModel.find({ isActive: true }).exec();
      
      this.pricingRules.clear();
      this.planCache.clear();
      
      for (const plan of plans) {
        // Cache the plan document
        this.planCache.set(plan.planId, plan);
        
        // Convert to PricingRule format for backward compatibility
        const pricingRule: PricingRule = {
          plan: plan.planId as SubscriptionPlan,
          basePrice: plan.pricing.baseAmount, // Already in dollars
          currency: plan.pricing.currency,
          conditions: this.convertConditionalPricing(plan.conditionalPricing),
        };
        
        this.pricingRules.set(plan.planId as SubscriptionPlan, pricingRule);
      }
      
      this.lastCacheUpdate = Date.now();
      this.logger.log(`Loaded ${plans.length} pricing rules from database`);
    } catch (error) {
      this.logger.error('Failed to load pricing rules from database:', error);
      // Fall back to hardcoded values if database fails
      this.initializeHardcodedPricingRules();
    }
  }

  private convertConditionalPricing(conditionalPricing: ConditionalPricingRule[]): PricingRule['conditions'] {
    if (!conditionalPricing || conditionalPricing.length === 0) {
      return undefined;
    }

    const conditions: PricingRule['conditions'] = {};
    
    for (const rule of conditionalPricing) {
      if (rule.type === 'free') {
        conditions.freeWithPlan = rule.requiredPlans as SubscriptionPlan[];
      } else if (rule.type === 'discount') {
        conditions.requiredPlan = rule.requiredPlans as SubscriptionPlan[];
        if (rule.discountAmount) {
          conditions.discountAmount = rule.discountAmount; // Already in dollars
        }
        if (rule.discountPercentage) {
          conditions.discountPercentage = rule.discountPercentage;
        }
      }
    }
    
    return Object.keys(conditions).length > 0 ? conditions : undefined;
  }

  private async refreshCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheExpiryTime) {
      await this.loadPricingRules();
    }
  }

  async calculatePrice(
    userId: string,
    targetPlan: SubscriptionPlan,
  ): Promise<CalculatedPrice> {
    await this.refreshCacheIfNeeded();
    
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const pricingRule = this.pricingRules.get(targetPlan);
    if (!pricingRule) {
      throw new Error(`No pricing rule found for plan: ${targetPlan}`);
    }

    let finalPrice = pricingRule.basePrice;
    let discount = 0;
    let discountReason: string | undefined;
    let isFree = false;

    // Get user's active subscriptions
    const activeSubscriptions = user.subscriptions
      .filter((sub) => !sub.expiresAt || sub.expiresAt > new Date())
      .map((sub) => sub.plan);

    // Apply conditional pricing
    if (pricingRule.conditions) {
      // Check if this plan is free with another plan
      if (pricingRule.conditions.freeWithPlan) {
        const hasFreeQualifyingPlan = pricingRule.conditions.freeWithPlan.some(
          (plan) => activeSubscriptions.includes(plan),
        );

        if (hasFreeQualifyingPlan) {
          finalPrice = 0;
          discount = pricingRule.basePrice;
          discountReason = 'Free with Live subscription';
          isFree = true;
        }
      }

      // Apply discounts if not free
      if (!isFree && pricingRule.conditions.requiredPlan) {
        const hasDiscountQualifyingPlan =
          pricingRule.conditions.requiredPlan.some((plan) =>
            activeSubscriptions.includes(plan),
          );

        if (hasDiscountQualifyingPlan) {
          if (pricingRule.conditions.discountAmount) {
            discount = pricingRule.conditions.discountAmount;
            finalPrice = pricingRule.basePrice - discount;
            discountReason = `$${discount} off with Live subscription`;
          } else if (pricingRule.conditions.discountPercentage) {
            discount =
              (pricingRule.basePrice *
                pricingRule.conditions.discountPercentage) /
              100;
            finalPrice = pricingRule.basePrice - discount;
            discountReason = `${pricingRule.conditions.discountPercentage}% off with Live subscription`;
          }
        }
      }
    }

    const result: CalculatedPrice = {
      plan: targetPlan,
      originalPrice: pricingRule.basePrice,
      finalPrice: Math.max(0, finalPrice), // Ensure price is never negative
      discount,
      discountReason,
      currency: pricingRule.currency,
      isFree,
    };

    this.logger.log(
      `Calculated price for user ${userId}, plan ${targetPlan}:`,
      result,
    );
    return result;
  }

  async calculatePricesForAllPlans(userId: string): Promise<CalculatedPrice[]> {
    await this.refreshCacheIfNeeded();
    
    const plans = Array.from(this.pricingRules.keys());
    const prices = await Promise.all(
      plans.map((plan) => this.calculatePrice(userId, plan)),
    );

    return prices;
  }

  async getPriceIdForPlan(plan: SubscriptionPlan): Promise<string> {
    await this.refreshCacheIfNeeded();
    
    const planDoc = this.planCache.get(plan);
    if (!planDoc) {
      throw new Error(`No plan found in database for: ${plan}`);
    }

    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const stripeIds = environment === 'production' 
      ? planDoc.stripeIds.production 
      : planDoc.stripeIds.development;

    if (!stripeIds.priceId) {
      throw new Error(`No price ID configured for plan: ${plan} in ${environment} environment`);
    }

    return stripeIds.priceId;
  }

  async validateSubscriptionEligibility(
    userId: string,
    targetPlan: SubscriptionPlan,
  ): Promise<{ eligible: boolean; reason?: string }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      return { eligible: false, reason: 'User not found' };
    }

    // Check if user already has this subscription
    const hasActiveSubscription = user.subscriptions.some(
      (sub) =>
        sub.plan === targetPlan &&
        (!sub.expiresAt || sub.expiresAt > new Date()),
    );

    if (hasActiveSubscription) {
      return { eligible: false, reason: 'Already subscribed to this plan' };
    }

    // Check for conflicting subscriptions
    if (
      targetPlan === SubscriptionPlan.LIVE_WEEKLY_MANUAL &&
      user.subscriptions.some(
        (sub) => sub.plan === SubscriptionPlan.LIVE_WEEKLY_RECURRING,
      )
    ) {
      return {
        eligible: false,
        reason: 'Already have recurring Live subscription',
      };
    }

    if (
      targetPlan === SubscriptionPlan.LIVE_WEEKLY_RECURRING &&
      user.subscriptions.some(
        (sub) => sub.plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL,
      )
    ) {
      return {
        eligible: false,
        reason: 'Already have manual Live subscription',
      };
    }

    // Check community membership requirement for community events
    if (targetPlan === SubscriptionPlan.COMMUNITY_EVENT) {
      const hasCommunityMembership = user.subscriptions.some(
        (sub) =>
          (sub.plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL ||
            sub.plan === SubscriptionPlan.LIVE_WEEKLY_RECURRING) &&
          (!sub.expiresAt || sub.expiresAt > new Date()),
      );

      if (!hasCommunityMembership) {
        return {
          eligible: false,
          reason:
            'Community membership (Live Weekly subscription) required for this event',
        };
      }
    }

    return { eligible: true };
  }

  getPricingRule(plan: SubscriptionPlan): PricingRule | undefined {
    return this.pricingRules.get(plan);
  }

  // Fallback hardcoded pricing rules (to be removed once database is confirmed working)
  private initializeHardcodedPricingRules() {
    this.logger.warn('Using hardcoded pricing rules as fallback');
    this.pricingRules = new Map([
      // Community Subscriptions (Weekly)
      [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        {
          plan: SubscriptionPlan.LIVE_WEEKLY_MANUAL,
          basePrice: 53.99,
          currency: 'usd',
        },
      ],
      [
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
        {
          plan: SubscriptionPlan.LIVE_WEEKLY_RECURRING,
          basePrice: 53.99,
          currency: 'usd',
        },
      ],

      // Recurring Monthly Subscriptions
      [
        SubscriptionPlan.MASTER_CLASES,
        {
          plan: SubscriptionPlan.MASTER_CLASES,
          basePrice: 199.99,
          currency: 'usd',
          conditions: {
            requiredPlan: [
              SubscriptionPlan.LIVE_WEEKLY_MANUAL,
              SubscriptionPlan.LIVE_WEEKLY_RECURRING,
            ],
            discountAmount: 177, // $22.99 for community members
          },
        },
      ],
      [
        SubscriptionPlan.LIVE_RECORDED,
        {
          plan: SubscriptionPlan.LIVE_RECORDED,
          basePrice: 52.99,
          currency: 'usd',
          conditions: {
            freeWithPlan: [
              SubscriptionPlan.LIVE_WEEKLY_MANUAL,
              SubscriptionPlan.LIVE_WEEKLY_RECURRING,
            ],
          },
        },
      ],
      [
        SubscriptionPlan.PSICOTRADING,
        {
          plan: SubscriptionPlan.PSICOTRADING,
          basePrice: 29.99,
          currency: 'usd',
        },
      ],

      // One-Time Purchases
      [
        SubscriptionPlan.CLASSES,
        {
          plan: SubscriptionPlan.CLASSES,
          basePrice: 500.0,
          currency: 'usd',
        },
      ],
      [
        SubscriptionPlan.PEACE_WITH_MONEY,
        {
          plan: SubscriptionPlan.PEACE_WITH_MONEY,
          basePrice: 199.99,
          currency: 'usd',
        },
      ],
      [
        SubscriptionPlan.MASTER_COURSE,
        {
          plan: SubscriptionPlan.MASTER_COURSE,
          basePrice: 2999.99,
          currency: 'usd',
        },
      ],
      [
        SubscriptionPlan.COMMUNITY_EVENT,
        {
          plan: SubscriptionPlan.COMMUNITY_EVENT,
          basePrice: 599.99,
          currency: 'usd',
        },
      ],
      [
        SubscriptionPlan.VIP_EVENT,
        {
          plan: SubscriptionPlan.VIP_EVENT,
          basePrice: 99.99,
          currency: 'usd',
        },
      ],
    ]);
  }
}