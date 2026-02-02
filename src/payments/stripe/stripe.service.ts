import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Stripe from 'stripe';
import {
  Transaction,
  BillingCycle,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
} from './transaction.schema';
import {
  SubscriptionHistory,
  SubscriptionAction,
} from './subscription-history.schema';
import { WebhookEvent, WebhookEventStatus } from './webhook-event.schema';
import { Model } from 'mongoose';
import { UserService } from 'src/users/users.service';
import { User } from 'src/users/user.schema';
import { SubscriptionPlan } from 'src/users/user.dto';
import {
  SubscriptionPlan as SubscriptionPlanSchema,
  SubscriptionPlanDocument,
} from 'src/subscriptions/subscription-plan.schema';
import { getLastDayOfMonth } from 'src/helpers/date';
import { EventRegistrationsService } from 'src/event/event-registration.service';
import { Event } from 'src/event/schemas/event.schema';
import { PricingService } from './pricing.service';
import { EmailService } from 'src/email/email.service';
import { AffiliateService } from 'src/affiliate/affiliate.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private logger = new Logger(StripeService.name);

  constructor(
    private moduleRef: ModuleRef,
    private configService: ConfigService,
    private userService: UserService,
    @Inject(forwardRef(() => EventRegistrationsService))
    private eventRegistrationsService: EventRegistrationsService,
    @Inject(forwardRef(() => AffiliateService))
    private affiliateService: AffiliateService,
    private pricingService: PricingService,
    private emailService: EmailService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name)
    private subscriptionHistoryModel: Model<SubscriptionHistory>,
    @InjectModel(WebhookEvent.name)
    private webhookEventModel: Model<WebhookEvent>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(SubscriptionPlanSchema.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  /**
   * Validates subscription eligibility and cleans up expired subscriptions before checkout.
   * - If ACTIVE subscription exists: Block with error
   * - If EXPIRED subscription exists: Cancel in Stripe, remove from user, allow checkout
   */
  private async validateAndCleanupSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<{ canProceed: boolean; reason?: string }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      return { canProceed: false, reason: 'User not found' };
    }

    const now = new Date();

    // Find ALL subscriptions for this plan (could be duplicates)
    const subscriptionsForPlan = user.subscriptions.filter(
      (sub) => sub.plan === plan,
    );

    if (subscriptionsForPlan.length === 0) {
      return { canProceed: true };
    }

    // Check if any subscription is still ACTIVE
    const activeSubscription = subscriptionsForPlan.find((sub) => {
      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const currentPeriodEnd = sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd)
        : null;
      const isActive =
        (!expiresAt || expiresAt > now) &&
        (!currentPeriodEnd || currentPeriodEnd > now) &&
        sub.status !== 'expired' &&
        sub.status !== 'cancelled';
      return isActive;
    });

    if (activeSubscription) {
      // ACTIVE subscription exists - block checkout
      this.logger.warn(
        `[Validation] User ${userId} has active ${plan} subscription - blocking checkout`,
      );
      return {
        canProceed: false,
        reason: `You already have an active ${plan} subscription. Please manage your existing subscription from your account settings.`,
      };
    }

    // All subscriptions are EXPIRED - clean them up
    this.logger.log(
      `[Cleanup] Found ${subscriptionsForPlan.length} expired ${plan} subscription(s) for user ${userId}`,
    );

    const stripeIdsToCancel: string[] = [];

    for (const sub of subscriptionsForPlan) {
      if (sub.stripeSubscriptionId) {
        stripeIdsToCancel.push(sub.stripeSubscriptionId);
        await this.safelyCancelStripeSubscription(sub.stripeSubscriptionId);
      }
    }

    // Remove from BOTH arrays atomically
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $pull: {
          subscriptions: { plan: plan },
          activeSubscriptions: { $in: stripeIdsToCancel },
        },
      },
    );

    this.logger.log(
      `[Cleanup] Removed expired ${plan} subscription(s) for user ${userId}`,
    );

    return { canProceed: true };
  }

  /**
   * Safely cancel a Stripe subscription with comprehensive error handling.
   * Handles: not found (404), already cancelled, network errors
   */
  private async safelyCancelStripeSubscription(
    subscriptionId: string,
  ): Promise<void> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status === 'canceled') {
        this.logger.log(
          `[Stripe] Subscription ${subscriptionId} already cancelled`,
        );
        return;
      }

      await this.stripe.subscriptions.cancel(subscriptionId);
      this.logger.log(`[Stripe] Cancelled subscription ${subscriptionId}`);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        this.logger.warn(
          `[Stripe] Subscription ${subscriptionId} not found in Stripe`,
        );
        return; // OK - doesn't exist, nothing to cancel
      }
      if (error.message?.toLowerCase().includes('already cancel')) {
        this.logger.log(
          `[Stripe] Subscription ${subscriptionId} already cancelled`,
        );
        return;
      }
      this.logger.error(
        `[Stripe] Error cancelling ${subscriptionId}: ${error.message}`,
      );
      // Don't throw - continue with cleanup even if Stripe cancel fails
    }
  }

  // ✅ **Create Checkout Session**
  async createCheckoutSession(userId: string, priceId: string) {
    const price = await this.stripe.prices.retrieve(priceId);
    const isRecurring = price.recurring !== null;
    const subscriptionPlan = await this.mapPriceIdToPlan(priceId);

    // Validate and cleanup before checkout (prevents duplicate subscriptions)
    if (subscriptionPlan) {
      const validation = await this.validateAndCleanupSubscription(
        userId,
        subscriptionPlan,
      );
      if (!validation.canProceed) {
        throw new BadRequestException(validation.reason);
      }
    }

    // Get BNPL methods based on amount and currency
    const bnplMethods = this.getBNPLMethods(
      price.unit_amount / 100,
      price.currency,
      isRecurring,
    );

    this.logger.log(
      `Creating checkout session with payment methods: ${['card', ...bnplMethods].join(', ')}`,
    );
    this.logger.log(
      `Amount: ${price.unit_amount / 100} ${price.currency}, Recurring: ${isRecurring}`,
    );

    // Get or create Stripe customer
    const user = await this.userService.findById(userId);
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.userService.updateUser(userId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: [
        'card',
        ...bnplMethods,
      ] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      mode: isRecurring ? 'subscription' : 'payment',
      customer: customerId,
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${subscriptionPlan}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/academy/subscription/plans`,
      line_items: [{ price: priceId, quantity: 1 }],
      // BNPL requires shipping address collection
      shipping_address_collection:
        bnplMethods.length > 0
          ? {
              allowed_countries: [
                'US',
                'CA',
                'GB',
                'AU',
                'NZ',
                'DE',
                'FR',
                'ES',
                'IT',
                'NL',
                'BE',
                'AT',
                'CH',
                'SE',
                'NO',
                'DK',
                'FI',
              ],
            }
          : undefined,
      // Phone number collection is required for some BNPL methods
      phone_number_collection:
        bnplMethods.length > 0
          ? {
              enabled: true,
            }
          : undefined,
      metadata: { userId, priceId, plan: subscriptionPlan }, // ✅ Store userId, priceId & plan
    });

    return { sessionId: session.id };
  }

  async createVipEventCheckoutSession(body: {
    eventId: string;
    priceId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    promoCode?: string;
  }) {
    const {
      eventId,
      priceId,
      firstName,
      lastName,
      email,
      phoneNumber,
      promoCode,
    } = body;

    let promotionCodeId: string | undefined = undefined;

    if (promoCode) {
      const promoCodeResult = await this.stripe.promotionCodes.list({
        code: promoCode,
        active: true,
      });

      if (promoCodeResult.data.length === 0) {
        throw new Error(`Invalid or inactive promotion code: ${promoCode}`);
      }

      promotionCodeId = promoCodeResult.data[0].id;
    }

    // Get price details to determine BNPL eligibility
    const price = await this.stripe.prices.retrieve(priceId);
    const bnplMethods = this.getBNPLMethods(
      price.unit_amount / 100,
      price.currency,
      false,
    );

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: [
        'card',
        ...bnplMethods,
      ] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      discounts: promotionCodeId
        ? [{ promotion_code: promotionCodeId }]
        : undefined,
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/events/thank-you`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/events/${eventId}`,
      customer_email: email,
      // BNPL requires shipping address collection
      shipping_address_collection:
        bnplMethods.length > 0
          ? {
              allowed_countries: [
                'US',
                'CA',
                'GB',
                'AU',
                'NZ',
                'DE',
                'FR',
                'ES',
                'IT',
                'NL',
                'BE',
                'AT',
                'CH',
                'SE',
                'NO',
                'DK',
                'FI',
              ],
            }
          : undefined,
      // Phone number collection is required for some BNPL methods
      phone_number_collection:
        bnplMethods.length > 0
          ? {
              enabled: true,
            }
          : undefined,
      metadata: {
        eventId,
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || '',
        isVip: 'true',
        paymentStatus: 'paid',
        promoCode,
      },
    });

    return { url: session.url };
  }

  // ✅ **Create Event Checkout Session (NEW)**
  async createEventCheckoutSession(body: {
    eventId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    additionalInfo?: {
      tradingExperience?: string;
      expectations?: string;
      additionalAttendees?: {
        adults: number;
        children: number;
        details: Array<{
          type: 'adult' | 'child';
          name: string;
          age?: number;
        }>;
      };
      [key: string]: any;
    };
    userId?: string;
    paymentMethod?: 'card' | 'klarna' | 'afterpay' | 'local_financing';
    financingPlanId?: string; // For local financing
    // Partial payment fields
    isPartialPayment?: boolean;
    paymentId?: string;
    amount?: number; // For partial payments
    description?: string;
    registrationId?: string;
    // Affiliate/referral fields
    affiliateCode?: string;
    affiliateId?: string;
    discountAmount?: number;
    commissionType?: 'percentage' | 'fixed';
    commissionRate?: number;
    commissionFixedAmount?: number;
  }) {
    const {
      eventId,
      firstName,
      lastName,
      email,
      phoneNumber,
      additionalInfo,
      userId,
      paymentMethod = 'card',
      isPartialPayment,
      paymentId,
      amount: partialPaymentAmount,
      description: paymentDescription,
      registrationId,
      affiliateCode,
      affiliateId,
      discountAmount,
      commissionType,
      commissionRate,
      commissionFixedAmount,
    } = body;

    // Get event details
    let event;

    // Handle special case for master course default
    if (eventId === 'master-course-default') {
      // Create a virtual event for master course checkout
      // This is used when no specific event is created in the database
      event = {
        _id: 'master-course-default',
        name: 'Master Trading Course',
        title: 'Curso Intensivo de Trading',
        type: 'master_course',
        price: 2999.99,
        requiresActiveSubscription: false,
        isActive: true,
      };
    } else {
      event = await this.eventRegistrationsService.findEventById(eventId);
      if (!event) {
        throw new NotFoundException('Event not found');
      }
    }

    // Check if user needs active subscription (only for community events)
    // Temporarily disabled subscription restrictions - anyone can pay
    // if (event.requiresActiveSubscription && userId) {
    //   const user = await this.userService.findById(userId);

    //   // For community events, check specifically for Live Semanal subscriptions
    //   if (event.type === 'community_event') {
    //     const hasLiveSemanalSubscription = user?.subscriptions?.some(
    //       (sub) =>
    //         sub.plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL ||
    //         sub.plan === SubscriptionPlan.LIVE_WEEKLY_RECURRING,
    //     );

    //     if (!hasLiveSemanalSubscription) {
    //       throw new BadRequestException(
    //         'This event requires an active Live Semanal subscription',
    //       );
    //     }
    //   }
    // } else if (event.requiresActiveSubscription && !userId) {
    //   // For community events without userId, we can't verify subscription
    //   if (event.type === 'community_event') {
    //     throw new BadRequestException(
    //       'Please log in to register for community events',
    //     );
    //   }
    // }

    // Check event capacity - skip for additional payments on existing registrations
    // If registrationId is provided, this is an additional payment, not a new registration
    if (!registrationId && event.capacity > 0 && event.currentRegistrations >= event.capacity) {
      throw new BadRequestException('Event is at full capacity');
    }

    // Reuse existing products from Stripe dashboard
    let productId: string | undefined;

    try {
      if (event.type === 'master_course') {
        // Search for existing MASTER_COURSE product
        const products = await this.stripe.products.list({ limit: 100 });
        const masterCourseProduct = products.data.find(
          (p) => p.name === 'MASTER_COURSE',
        );
        productId = masterCourseProduct?.id;
      } else if (event.type === 'community_event') {
        // Search for existing COMMUNITY_EVENT product
        const products = await this.stripe.products.list({ limit: 100 });
        const communityEventProduct = products.data.find(
          (p) => p.name === 'COMMUNITY_EVENT',
        );
        productId = communityEventProduct?.id;
      }
    } catch (error) {
      console.error('Error searching for products:', error);
    }

    // Calculate total price including additional attendees
    let totalPrice = event.price || 0;
    let adultsCount = 0;
    let childrenCount = 0;

    // If this is a partial payment, use the specified amount instead
    if (isPartialPayment && partialPaymentAmount) {
      totalPrice = partialPaymentAmount;
      this.logger.log(`🔵 Partial payment detected - Amount: $${totalPrice}`);
      this.logger.log(`🔵 Payment ID: ${paymentId}`);
      this.logger.log(`🔵 Registration ID: ${registrationId}`);
    } else {
      if (additionalInfo?.additionalAttendees) {
        adultsCount = additionalInfo.additionalAttendees.adults || 0;
        childrenCount = additionalInfo.additionalAttendees.children || 0;
        // Adult: $75, Child: $48
        totalPrice += adultsCount * 75 + childrenCount * 48;

        this.logger.log(
          `Additional attendees: ${adultsCount} adults, ${childrenCount} children`,
        );
        this.logger.log(
          `Price calculation: Base $${event.price} + Adults $${adultsCount * 75} + Children $${childrenCount * 48} = Total $${totalPrice}`,
        );
      }
    }

    // Store the original price before any modifications
    const basePrice = totalPrice;

    // Apply affiliate discount if provided
    if (affiliateCode && discountAmount && discountAmount > 0) {
      totalPrice = totalPrice - discountAmount;
      this.logger.log(
        `Affiliate discount applied: Code ${affiliateCode}, Discount $${discountAmount}`,
      );
      this.logger.log(
        `Price after discount: $${basePrice} - $${discountAmount} = $${totalPrice}`,
      );
    }

    // Apply payment method fees
    const priceBeforeFees = totalPrice;
    if (paymentMethod === 'klarna') {
      const klarnaFeePercentage = parseFloat(
        this.configService.get<string>('KLARNA_FEE_PERCENTAGE') || '0.0644',
      );
      totalPrice = totalPrice * (1 + klarnaFeePercentage);
      this.logger.log(
        `Klarna fee applied: ${(klarnaFeePercentage * 100).toFixed(2)}%`,
      );
      this.logger.log(
        `Price with Klarna fee: $${priceBeforeFees} → $${totalPrice.toFixed(2)}`,
      );
    } else if (paymentMethod === 'afterpay') {
      // Apply Afterpay fee silently (6% but not shown to customer)
      const afterpayFeePercentage = 0.06;
      totalPrice = totalPrice * (1 + afterpayFeePercentage);
      this.logger.log(
        `Afterpay fee applied (hidden): ${(afterpayFeePercentage * 100).toFixed(2)}%`,
      );
      this.logger.log(
        `Price with Afterpay fee: $${priceBeforeFees} → $${totalPrice.toFixed(2)}`,
      );
    }

    // Create price
    let price;
    if (productId) {
      // Create a one-time price for the existing product
      price = await this.stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(totalPrice * 100), // Convert to cents
        product: productId,
      });
    } else {
      // Only create inline product for non-standard events
      // This should rarely happen if MASTER_COURSE and COMMUNITY_EVENT products exist
      console.warn(
        `No product found for event type: ${event.type}. Creating inline product.`,
      );
      price = await this.stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(totalPrice * 100), // Convert to cents
        product_data: {
          name: event.title || event.name,
          metadata: {
            eventType: event.type || 'general',
          },
        },
      });
    }

    // Determine payment methods based on selection
    let paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      [];

    if (paymentMethod === 'klarna') {
      paymentMethods = ['klarna'];
    } else if (paymentMethod === 'afterpay') {
      paymentMethods = ['afterpay_clearpay'];
    } else {
      paymentMethods = ['card'];
    }

    this.logger.log(`Creating event checkout for ${event.name || event.title}`);
    this.logger.log(`Payment method: ${paymentMethod}`);
    this.logger.log(`Total price: $${totalPrice.toFixed(2)} USD`);

    // Determine success URL based on payment type
    let successUrl: string;
    if (isPartialPayment) {
      // Redirect to partial payment success page
      successUrl = event.type === 'master_course'
        ? `${this.configService.get<string>('FRONTEND_URL')}/master-course/partial-payment-success?session_id={CHECKOUT_SESSION_ID}&registration_id=${registrationId || ''}`
        : `${this.configService.get<string>('FRONTEND_URL')}/community-event/partial-payment-success?session_id={CHECKOUT_SESSION_ID}&registration_id=${registrationId || ''}`;
    } else {
      // Redirect to full payment success page
      successUrl = event.type === 'master_course'
        ? `${this.configService.get<string>('FRONTEND_URL')}/master-course/success?session_id={CHECKOUT_SESSION_ID}`
        : `${this.configService.get<string>('FRONTEND_URL')}/community-event/success?session_id={CHECKOUT_SESSION_ID}&event=${eventId}`;
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/${event.type === 'master_course' ? 'master-course' : 'community-event'}`,
      customer_email: email,
      // Klarna requires shipping address collection
      ...(paymentMethod === 'klarna' && {
        shipping_address_collection: {
          allowed_countries: [
            'US',
            'CA',
            'GB',
            'AU',
            'NZ',
            'DE',
            'FR',
            'ES',
            'IT',
            'NL',
            'BE',
            'AT',
            'CH',
            'SE',
            'NO',
            'DK',
            'FI',
          ],
        },
      }),
      // Phone number collection is required for Klarna
      phone_number_collection: {
        enabled: paymentMethod === 'klarna',
      },
      metadata: {
        eventRegistration: 'true',
        eventId,
        eventType: event.type,
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || '',
        userId: userId || '',
        additionalInfo: JSON.stringify(additionalInfo || {}),
        registrationType: event.requiresActiveSubscription
          ? 'member_exclusive'
          : 'paid',
        // Partial payment metadata
        isPartialPayment: isPartialPayment ? 'true' : 'false',
        paymentId: paymentId || '',
        registrationId: registrationId || '',
        paymentDescription: paymentDescription || '',
        // Additional attendee metadata
        basePrice: (event.price || 0).toString(),
        additionalAdults: adultsCount.toString(),
        additionalChildren: childrenCount.toString(),
        totalPrice: totalPrice.toString(),
        guestDetails: JSON.stringify(
          additionalInfo?.additionalAttendees?.details || [],
        ),
        paymentMethod: paymentMethod,
        originalPrice: basePrice.toString(),
        klarnaFee:
          paymentMethod === 'klarna'
            ? (totalPrice - priceBeforeFees).toFixed(2)
            : '0',
        afterpayFee:
          paymentMethod === 'afterpay'
            ? (totalPrice - priceBeforeFees).toFixed(2)
            : '0',
        // Affiliate tracking metadata
        affiliateCode: affiliateCode || '',
        affiliateId: affiliateId || '',
        discountAmount: discountAmount ? discountAmount.toString() : '0',
        commissionType: commissionType || 'percentage',
        commissionRate: commissionRate ? commissionRate.toString() : '0',
        commissionFixedAmount: commissionFixedAmount ? commissionFixedAmount.toString() : '0',
        finalPrice: totalPrice.toString(),
      },
    });

    this.logger.log(`✅ Stripe checkout session created: ${session.id}`);
    this.logger.log(`✅ Checkout URL: ${session.url}`);

    return { url: session.url, sessionId: session.id };
  }

  // Create checkout session for adding attendees to existing event registration
  async createEventAttendeeCheckoutSession(params: {
    amount: number;
    metadata: Record<string, string>;
    email: string;
    paymentMethod: 'card' | 'klarna' | 'afterpay' | 'local_financing';
  }) {
    const { amount, metadata, email, paymentMethod } = params;

    // Payment method configuration
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      ['card'];
    if (paymentMethod === 'klarna') {
      paymentMethodTypes.push(
        'klarna' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );
    } else if (paymentMethod === 'afterpay') {
      paymentMethodTypes.push(
        'afterpay_clearpay' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Invitados Adicionales - Mentoría Presencial',
              description: `${metadata.additionalAdults} adultos, ${metadata.additionalChildren} niños`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${process.env.FRONTEND_URL}/community-event/manage-registration?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/community-event/manage-registration?canceled=true`,
    });

    return { url: session.url, sessionId: session.id };
  }

  // ✅ **Create Enhanced Checkout Session with BNPL and Conditional Pricing**
  async createEnhancedCheckoutSession(
    userId: string,
    plan: SubscriptionPlan,
    options?: {
      paymentMethods?: string[];
      metadata?: Record<string, string>;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    // Validate and cleanup before checkout (prevents duplicate subscriptions)
    const validation = await this.validateAndCleanupSubscription(userId, plan);
    if (!validation.canProceed) {
      throw new BadRequestException(validation.reason);
    }

    // Validate subscription eligibility
    const eligibility =
      await this.pricingService.validateSubscriptionEligibility(userId, plan);
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason);
    }

    // Calculate price with conditional pricing
    const calculatedPrice = await this.pricingService.calculatePrice(
      userId,
      plan,
    );

    // Get or create Stripe customer
    const user = await this.userService.findById(userId);
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.userService.updateUser(userId, {
        stripeCustomerId: customerId,
      });
    }

    // Determine billing cycle and mode
    const isRecurring = [
      SubscriptionPlan.MASTER_CLASES,
      SubscriptionPlan.LIVE_RECORDED,
      SubscriptionPlan.PSICOTRADING,
      SubscriptionPlan.LIVE_WEEKLY_RECURRING,
    ].includes(plan);

    const isWeekly = [
      SubscriptionPlan.LIVE_WEEKLY_MANUAL,
      SubscriptionPlan.LIVE_WEEKLY_RECURRING,
    ].includes(plan);

    // Configure payment methods including BNPL
    const paymentMethods = options?.paymentMethods || ['card'];
    const bnplMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      [];

    if (paymentMethods.includes('klarna'))
      bnplMethods.push(
        'klarna' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );
    if (paymentMethods.includes('afterpay_clearpay'))
      bnplMethods.push(
        'afterpay_clearpay' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );
    if (paymentMethods.includes('affirm'))
      bnplMethods.push(
        'affirm' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );

    // Create line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (calculatedPrice.isFree) {
      // Free subscription (e.g., CLASS with Live subscription)
      lineItems.push({
        price_data: {
          currency: calculatedPrice.currency,
          product_data: {
            name: `${plan} Subscription (Free with Live)`,
            description: calculatedPrice.discountReason,
          },
          unit_amount: 0,
          ...(isRecurring && {
            recurring: {
              interval: isWeekly ? 'week' : 'month',
            },
          }),
        },
        quantity: 1,
      });
    } else {
      // Paid subscription
      // For manual weekly plan, always create price data on the fly as one-time payment
      if (plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL) {
        lineItems.push({
          price_data: {
            currency: calculatedPrice.currency,
            product_data: {
              name: 'Live Semanal - Pago Manual',
              description: 'Acceso semanal al trading en vivo con renovación manual',
            },
            unit_amount: Math.round(calculatedPrice.finalPrice * 100),
            // No recurring properties for manual payment
          },
          quantity: 1,
        });
      } else {
        // For other plans, use existing price ID or create recurring price
        const priceId = await this.pricingService.getPriceIdForPlan(plan);

        if (priceId.startsWith('price_')) {
          // Use existing price ID
          lineItems.push({
            price: priceId,
            quantity: 1,
          });
        } else {
          // Create price data on the fly (for new plans without price IDs yet)
          lineItems.push({
            price_data: {
              currency: calculatedPrice.currency,
              product_data: {
                name: `${plan} Subscription`,
                ...(calculatedPrice.discountReason && {
                  description: calculatedPrice.discountReason,
                }),
              },
              unit_amount: Math.round(calculatedPrice.finalPrice * 100),
              ...(isRecurring && {
                recurring: {
                  interval: isWeekly ? 'week' : 'month',
                },
              }),
            },
            quantity: 1,
          });
        }
      }
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: [
        'card',
        ...bnplMethods,
      ] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      mode: isRecurring ? 'subscription' : 'payment',
      customer: customerId,
      line_items: lineItems,
      success_url:
        options?.successUrl ||
        `${this.configService.get<string>('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:
        options?.cancelUrl ||
        `${this.configService.get<string>('FRONTEND_URL')}/academy/subscription/plans`,
      // BNPL requires shipping address collection
      shipping_address_collection:
        bnplMethods.length > 0
          ? {
              allowed_countries: [
                'US',
                'CA',
                'GB',
                'AU',
                'NZ',
                'DE',
                'FR',
                'ES',
                'IT',
                'NL',
                'BE',
                'AT',
                'CH',
                'SE',
                'NO',
                'DK',
                'FI',
              ],
            }
          : undefined,
      // Phone number collection is required for some BNPL methods
      phone_number_collection:
        bnplMethods.length > 0
          ? {
              enabled: true,
            }
          : undefined,
      metadata: {
        userId: userId.toString(),
        plan,
        originalPrice: calculatedPrice.originalPrice.toString(),
        finalPrice: calculatedPrice.finalPrice.toString(),
        discount: calculatedPrice.discount.toString(),
        billingCycle: isWeekly ? BillingCycle.WEEKLY : BillingCycle.MONTHLY,
        ...options?.metadata,
      },
      subscription_data: isRecurring
        ? {
            metadata: {
              userId: userId.toString(),
              plan,
              billingCycle: isWeekly
                ? BillingCycle.WEEKLY
                : BillingCycle.MONTHLY,
            },
          }
        : undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      // Enable tax collection if needed
      automatic_tax: {
        enabled: false, // Set to true if you have Stripe Tax configured
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
      calculatedPrice,
    };
  }

  // ✅ **Create Weekly Manual Subscription**
  async createWeeklyManualSubscription(userId: string) {
    const plan = SubscriptionPlan.LIVE_WEEKLY_MANUAL;
    const session = await this.createEnhancedCheckoutSession(userId, plan, {
      metadata: {
        subscriptionType: 'manual_weekly',
        expiresInDays: '7',
      },
    });

    return session;
  }

  // ✅ **Create Weekly Recurring Subscription**
  async createWeeklyRecurringSubscription(userId: string) {
    const plan = SubscriptionPlan.LIVE_WEEKLY_RECURRING;
    const session = await this.createEnhancedCheckoutSession(userId, plan, {
      metadata: {
        subscriptionType: 'recurring_weekly',
      },
    });

    return session;
  }

  // ✅ **Create Classes Checkout Session**
  async createClassesCheckoutSession(
    userId: string,
    paymentMethod: 'card' | 'klarna' | 'afterpay' = 'card',
  ) {
    // Validate and cleanup before checkout (prevents duplicate subscriptions)
    const validation = await this.validateAndCleanupSubscription(
      userId,
      SubscriptionPlan.CLASSES,
    );
    if (!validation.canProceed) {
      throw new BadRequestException(validation.reason);
    }

    // Get user details
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.userService.updateUser(userId, {
        stripeCustomerId: customerId,
      });
    }

    // Search for existing CLASSES product in Stripe
    let productId: string | undefined;
    try {
      const products = await this.stripe.products.list({ limit: 100 });
      const classesProduct = products.data.find(
        (p) => p.name === 'CLASSES' || p.name === 'Classes de Trading',
      );
      productId = classesProduct?.id;
    } catch (error) {
      console.error('Error searching for CLASSES product:', error);
    }

    // Calculate price based on payment method
    const basePrice = 500; // $500 USD
    let finalPrice = basePrice;

    // Apply payment method fees
    if (paymentMethod === 'klarna') {
      const klarnaFeePercentage = parseFloat(
        this.configService.get<string>('KLARNA_FEE_PERCENTAGE') || '0.0644',
      );
      finalPrice = basePrice * (1 + klarnaFeePercentage);
      this.logger.log(
        `Klarna fee applied: ${(klarnaFeePercentage * 100).toFixed(2)}%`,
      );
      this.logger.log(
        `Price with Klarna fee: $${basePrice} → $${finalPrice.toFixed(2)}`,
      );
    } else if (paymentMethod === 'afterpay') {
      // Apply Afterpay fee silently (6% but not shown to customer)
      const afterpayFeePercentage = 0.06;
      finalPrice = basePrice * (1 + afterpayFeePercentage);
      this.logger.log(
        `Afterpay fee applied (hidden): ${(afterpayFeePercentage * 100).toFixed(2)}%`,
      );
      this.logger.log(
        `Price with Afterpay fee: $${basePrice} → $${finalPrice.toFixed(2)}`,
      );
    }

    let priceObj;

    if (productId) {
      // Create a one-time price for the existing product
      priceObj = await this.stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(finalPrice * 100), // Convert to cents
        product: productId,
      });
    } else {
      // Create inline product if no existing product found
      priceObj = await this.stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(finalPrice * 100), // Convert to cents
        product_data: {
          name: 'Classes de Trading',
          metadata: {
            type: 'classes',
            duration: '15_days',
          },
        },
      });
    }

    // Determine payment method types based on selection
    let paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      [];

    if (paymentMethod === 'klarna') {
      paymentMethodTypes = ['klarna'];
    } else if (paymentMethod === 'afterpay') {
      paymentMethodTypes = ['afterpay_clearpay'];
    } else {
      paymentMethodTypes = ['card'];
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceObj.id, quantity: 1 }],
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/classes/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/classes`,
      // Klarna requires shipping address collection
      ...(paymentMethod === 'klarna' && {
        shipping_address_collection: {
          allowed_countries: [
            'US',
            'CA',
            'GB',
            'AU',
            'NZ',
            'DE',
            'FR',
            'ES',
            'IT',
            'NL',
            'BE',
            'AT',
            'CH',
            'SE',
            'NO',
            'DK',
            'FI',
          ],
        },
      }),
      // Phone number collection is required for Klarna
      phone_number_collection: {
        enabled: paymentMethod === 'klarna',
      },
      metadata: {
        userId: userId.toString(),
        type: 'classes_purchase',
        accessDuration: '15_days',
        classesCount: '8',
        paymentMethod,
        originalPrice: basePrice.toString(),
        finalPrice: finalPrice.toFixed(2),
      },
    });

    this.logger.log(
      `Created classes checkout session for user ${userId}: ${session.id} with payment method: ${paymentMethod}`,
    );

    return { url: session.url, sessionId: session.id };
  }

  // ✅ **Handle Webhook Events**
  async handleWebhookEvent(signature: string, rawBody: Buffer) {
    this.logger.log('📥 Webhook received in handleWebhookEvent');
    console.log('🔍 Debug - Signature:', signature ? 'Present' : 'Missing');
    console.log('🔍 Debug - RawBody type:', typeof rawBody);
    console.log('🔍 Debug - RawBody is Buffer:', Buffer.isBuffer(rawBody));
    
    // Log the raw payload to see what we're receiving
    try {
      const rawString = rawBody.toString('utf8');
      const parsedBody = JSON.parse(rawString);
      console.log('📦 RAW WEBHOOK PAYLOAD:');
      console.log('  Event ID:', parsedBody.id);
      console.log('  Event Type:', parsedBody.type);
      console.log('  API Version:', parsedBody.api_version);
      if (parsedBody.data?.object) {
        console.log('  Object Type:', parsedBody.data.object.object);
        console.log('  Object ID:', parsedBody.data.object.id);
        if (parsedBody.type === 'invoice.payment_succeeded') {
          console.log('  Customer:', parsedBody.data.object.customer);
          console.log('  Subscription:', parsedBody.data.object.subscription);
          console.log('  Amount Paid:', parsedBody.data.object.amount_paid);
        }
      }
    } catch (parseErr) {
      console.error('Could not parse raw body for logging:', parseErr.message);
    }
    
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    console.log('🔍 Debug - Webhook secret configured:', !!webhookSecret);
    console.log('🔍 Debug - Webhook secret starts with:', webhookSecret?.substring(0, 10));
    
    let event: Stripe.Event;

    try {
      console.log('🔍 Debug - Attempting to construct event...');
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      this.logger.log(`✅ Webhook verified: ${event.type}`);
      console.log('✅ Event type:', event.type);
      console.log('✅ Event ID:', event.id);
      
      // Log more details for invoice.payment_succeeded
      if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as any;
        console.log('📋 Invoice ID:', invoice.id);
        console.log('📋 Customer ID:', invoice.customer);
        console.log('📋 Subscription ID:', invoice.subscription);
        console.log('📋 Has lines data:', !!invoice.lines?.data);
        if (invoice.lines?.data?.[0]) {
          console.log('📋 Line metadata:', invoice.lines.data[0].metadata);
          console.log('📋 Period end:', invoice.lines.data[0].period?.end);
        }
      }
    } catch (err) {
      this.logger.error('⚠️ Webhook verification failed.', err.message);
      console.error('❌ Webhook verification error:', err.message);
      console.error('❌ Error type:', err.type);
      throw new Error('Invalid webhook signature');
    }

    // Check if we've already processed this event
    const existingEvent = await this.webhookEventModel.findOne({
      stripeEventId: event.id,
    });

    if (existingEvent) {
      this.logger.warn(`⚠️ Event ${event.id} already processed`);
      console.log('⚠️ DUPLICATE EVENT - Already processed:', event.id);
      console.log('  Original processing date:', existingEvent.createdAt);
      console.log('  Original status:', existingEvent.status);
      return;
    }
    
    console.log('✅ Event is new, proceeding with processing...');

    // Log the webhook event
    const webhookEvent = await this.webhookEventModel.create({
      stripeEventId: event.id,
      eventType: event.type,
      status: WebhookEventStatus.RECEIVED,
      eventData: event.data.object,
    });

    try {
      // Update status to processing
      webhookEvent.status = WebhookEventStatus.PROCESSING;
      await webhookEvent.save();

      console.log('📋 Processing event type:', event.type);
      console.log('📋 About to enter switch statement...');

      switch (event.type) {
        case 'checkout.session.completed':
          console.log('➡️ Handling checkout.session.completed');
          await this.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case 'invoice.payment_succeeded':
          console.log('➡️ Handling invoice.payment_succeeded');
          console.log('  Invoice object:', event.data.object);
          await this.handleRecurringPayment(
            event.data.object as Stripe.Invoice,
          );
          console.log('✅ Finished handling invoice.payment_succeeded');
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        default:
          this.logger.warn(`ℹ️ Unhandled event type: ${event.type}`);
          webhookEvent.status = WebhookEventStatus.IGNORED;
          await webhookEvent.save();
          return;
      }

      // Mark as processed
      webhookEvent.status = WebhookEventStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
    } catch (error) {
      // Log error and mark as failed
      this.logger.error(`Error processing webhook event ${event.id}:`, error);
      webhookEvent.status = WebhookEventStatus.FAILED;
      webhookEvent.errorMessage = error.message;
      webhookEvent.errorStack = error.stack;
      await webhookEvent.save();
      throw error;
    }
  }

  // ✅ **Handle Event Registration (NEW)**
  private async handleEventRegistration(session: Stripe.Checkout.Session) {
    this.logger.log('🎟️ Processing event registration');

    const {
      eventId,
      eventType,
      firstName,
      lastName,
      email,
      phoneNumber,
      userId,
      additionalInfo,
      registrationType,
    } = session.metadata || {};

    if (!eventId || !email) {
      this.logger.error('Missing required event registration data');
      return;
    }

    try {
      // Parse additional info if present
      const parsedAdditionalInfo = additionalInfo
        ? JSON.parse(additionalInfo)
        : {};

      let actualEventId = eventId;
      let event;

      // Special handling for master-course-default
      if (eventId === 'master-course-default') {
        // Try to find an active master course event
        const events = await this.eventModel
          .find({
            type: 'master_course',
            isActive: true,
          })
          .exec();

        if (events.length > 0) {
          event = events[0];
          actualEventId = event._id.toString();
          this.logger.log(`Found master course event: ${actualEventId}`);
        } else {
          // If no event exists, log error but continue to create transaction
          this.logger.error('No active master course event found in database');
          // Don't return here - we still want to create a transaction
        }
      } else {
        // For regular events, fetch the event
        event = await this.eventRegistrationsService.findEventById(eventId);
      }

      // Create event registration (if we have a valid event)
      let registration: any;
      if (event && actualEventId !== 'master-course-default') {
        const totalAmount = session.amount_total ? session.amount_total / 100 : 0;

        registration = await this.eventRegistrationsService.create({
          eventId: actualEventId,
          firstName,
          lastName,
          email,
          phoneNumber,
          isVip: false,
          userId: userId || undefined,
          additionalInfo: parsedAdditionalInfo,
          registrationType: registrationType || 'paid',
          paymentStatus: 'paid',
          amountPaid: totalAmount,
          // Add partial payment fields for consistency (full payment in one go)
          totalAmount: totalAmount,
          totalPaid: totalAmount,
          remainingBalance: 0,
          isFullyPaid: true,
          paymentMode: 'full',
          stripeSessionId: session.id,
          paymentMethod: session.metadata?.paymentMethod || 'card',
          klarnaFee: parseFloat(session.metadata?.klarnaFee || '0'),
        });

        this.logger.log(`✅ Event registration created for ${email} - Amount: $${totalAmount}`);

        // Update event registration count
        event.currentRegistrations = (event.currentRegistrations || 0) + 1;
        await event.save();
      }

      // Create transaction record for financial tracking
      const amount = session.amount_total ? session.amount_total / 100 : 0;
      const currency = session.currency || 'usd';

      // Determine the plan based on event type
      let plan = SubscriptionPlan.COMMUNITY_EVENT; // Default for events
      if (eventType === 'master_course') {
        plan = SubscriptionPlan.MASTER_COURSE; // We'll need to add this to the enum
      }

      const transaction = await this.transactionModel.create({
        userId: userId || undefined,
        amount,
        currency,
        status:
          session.payment_status === 'paid'
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.PENDING,
        plan,
        type: TransactionType.EVENT_PAYMENT,
        stripeSessionId: session.id,
        stripeCustomerId: session.customer as string,
        stripePaymentIntentId: session.payment_intent as string,
        paymentMethod: this.mapStripePaymentMethodType(
          session.payment_method_types?.[0] || 'card',
        ),
        billingCycle: BillingCycle.ONE_TIME,
        metadata: {
          eventId: actualEventId,
          eventType: eventType || 'general',
          eventName: event?.name || 'Master Trading Course',
          firstName,
          lastName,
          email,
          phoneNumber,
          registrationType,
        },
      });

      this.logger.log(
        `✅ Event registration completed for ${email} - Event: ${actualEventId}, Transaction: ${transaction._id}`,
      );

      // Create commission record if affiliate code is present
      if (session.metadata?.affiliateCode && session.metadata?.affiliateId) {
        try {
          const affiliateCode = session.metadata.affiliateCode;
          const affiliateId = session.metadata.affiliateId;
          const discountAmount = parseFloat(session.metadata.discountAmount || '0');
          const commissionType = (session.metadata.commissionType || 'percentage') as 'percentage' | 'fixed';
          const commissionRate = parseFloat(session.metadata.commissionRate || '0');
          const commissionFixedAmount = parseFloat(session.metadata.commissionFixedAmount || '0');
          const finalPrice = parseFloat(session.metadata.finalPrice || amount.toString());

          await this.affiliateService.createCommission({
            affiliateId,
            affiliateCode,
            registrationId: registration?._id?.toString() || session.id,
            customerEmail: email,
            customerName: `${firstName} ${lastName}`,
            originalPrice: parseFloat(session.metadata.originalPrice || amount.toString()),
            discountAmount,
            finalPrice,
            commissionType,
            commissionRate,
            commissionFixedAmount,
            stripeSessionId: session.id,
            paymentMethod: session.payment_method_types?.[0] || 'card',
            metadata: {
              eventName: event?.name || 'Master Trading Course',
              eventType,
              eventDate: event?.date,
            },
          });

          this.logger.log(
            `✅ Commission record created for affiliate ${affiliateCode}`,
          );
        } catch (error) {
          this.logger.error('Failed to create commission record:', error);
          // Don't throw - we don't want to fail the registration if commission creation fails
        }
      }

      // Grant Classes access for Master Course registrations
      if (eventType === 'master_course' && userId) {
        try {
          this.logger.log(
            `🎓 Granting Classes access for Master Course registration - User: ${userId}`,
          );

          // Add CLASSES subscription with 15-day expiration
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 15);

          await this.userService.updateUser(userId, {
            $push: {
              subscriptions: {
                plan: SubscriptionPlan.CLASSES,
                expiresAt: expirationDate,
              },
            },
          });

          this.logger.log(
            `✅ Classes access granted successfully for user ${userId} until ${expirationDate}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to grant Classes access for user ${userId}:`,
            error,
          );
        }
      }

      // Send email notification
      if (this.emailService) {
        try {
          // For master course, send with dynamic event dates from database
          if (eventType === 'master_course') {
            await this.emailService.sendEventRegistrationEmail(email, {
              firstName,
              eventName: event?.name || event?.title || 'Master Trading Course',
              eventType: 'master_course',
              eventLocation: event?.location || 'Tampa, Florida',
              // Pass dates from the database event
              eventStartDate: event?.startDate ? new Date(event.startDate) : undefined,
              eventEndDate: event?.endDate ? new Date(event.endDate) : undefined,
              eventDate: event?.date ? new Date(event.date) : undefined,
              ticketNumber: registration?._id?.toString() || session.id,
              isPaid: registrationType === 'paid',
              amount: session.amount_total
                ? session.amount_total / 100
                : undefined,
              currency: session.currency,
              additionalInfo: parsedAdditionalInfo,
            });
          } else if (event) {
            // For regular events, send full event data
            await this.emailService.sendEventRegistrationEmail(email, {
              firstName,
              eventName: event.title || event.name,
              eventType: (event.type || eventType) as
                | 'community_event'
                | 'vip_event',
              eventDate: event.date ? new Date(event.date) : undefined,
              eventStartDate: event.startDate ? new Date(event.startDate) : undefined,
              eventEndDate: event.endDate ? new Date(event.endDate) : undefined,
              eventTime: (event as any).time,
              eventLocation: event.location,
              hotelName: event.metadata?.hotel,
              hotelAddress: event.metadata?.hotelAddress,
              eventDescription: event.description,
              ticketNumber: registration?._id?.toString() || session.id,
              isPaid: registrationType === 'paid',
              amount: session.amount_total
                ? session.amount_total / 100
                : undefined,
              currency: session.currency,
              additionalAdults: parsedAdditionalInfo?.additionalAttendees?.adults || 0,
              additionalChildren: parsedAdditionalInfo?.additionalAttendees?.children || 0,
            });
          }

          // Add to Brevo marketing list
          if (event) {
            await this.emailService.addEventRegistrantToMarketingList(
              email,
              firstName,
              lastName,
              phoneNumber,
              eventType,
            );
          } else {
            // Fallback to simple email if event not found
            await this.emailService.sendEventRegistrationConfirmation(email);
          }
        } catch (emailError) {
          this.logger.error(
            'Failed to send event registration email:',
            emailError,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing event registration:', error);
      throw error;
    }
  }

  // ✅ **Handle Classes Purchase**
  private async handleClassesPurchase(session: Stripe.Checkout.Session) {
    this.logger.log('📚 Processing classes purchase');

    const userId = session.metadata?.userId;

    if (!userId) {
      this.logger.error('Missing userId for classes purchase');
      return;
    }

    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const currency = session.currency || 'usd';

    try {
      // Create transaction record
      const transaction = await this.transactionModel.create({
        userId,
        amount,
        currency,
        status:
          session.payment_status === 'paid'
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.PENDING,
        plan: SubscriptionPlan.CLASSES,
        type: TransactionType.ONE_TIME_PURCHASE,
        stripeSessionId: session.id,
        stripeCustomerId: session.customer as string,
        stripePaymentIntentId: session.payment_intent as string,
        paymentMethod: this.mapStripePaymentMethodType(
          session.payment_method_types?.[0] || 'card',
        ),
        billingCycle: BillingCycle.ONE_TIME,
        metadata: session.metadata,
      });

      // Add CLASSES subscription with 15-day expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 15);

      // Remove any existing CLASSES subscription
      await this.userService.updateUser(userId, {
        $pull: { subscriptions: { plan: SubscriptionPlan.CLASSES } },
      });

      // Add new CLASSES subscription
      await this.userService.updateUser(userId, {
        $push: {
          subscriptions: {
            plan: SubscriptionPlan.CLASSES,
            expiresAt: expirationDate,
            createdAt: new Date(),
            status: 'active',
          },
        },
      });

      // Record subscription history
      await this.subscriptionHistoryModel.create({
        userId,
        transactionId: transaction._id,
        plan: SubscriptionPlan.CLASSES,
        action: SubscriptionAction.CREATED,
        stripeEventId: session.id,
        price: amount,
        currency,
        effectiveDate: new Date(),
        expirationDate,
        metadata: session.metadata,
      });

      this.logger.log(
        `✅ Classes access granted to user ${userId} until ${expirationDate}`,
      );

      // Send confirmation email
      try {
        const user = await this.userService.findById(userId);
        if (user && this.emailService) {
          await this.emailService.sendPaymentConfirmationEmail(user.email, {
            firstName: user.firstName,
            planName: 'Clases de Trading',
            amount,
            currency,
            billingCycle: BillingCycle.ONE_TIME,
            transactionId: transaction._id.toString(),
            expiresAt: expirationDate,
            isRecurring: false,
          });
        }
      } catch (emailError) {
        this.logger.error(
          'Failed to send classes purchase confirmation email:',
          emailError,
        );
      }
    } catch (error) {
      this.logger.error('Error processing classes purchase:', error);
      throw error;
    }
  }

  // ✅ **Handle First-Time Checkout Completion**
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    this.logger.log('🎯 Processing checkout.session.completed event');
    this.logger.log(`Session ID: ${session.id}`);
    this.logger.log(`Metadata: ${JSON.stringify(session.metadata)}`);

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as SubscriptionPlan;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const currency = session.currency || 'usd';
    const subscriptionId = session.subscription as string;
    const paymentMethod = session.payment_method_types?.[0] || 'card';

    // Handle Partial Payment for Events
    if (session.metadata?.isPartialPayment === 'true' && session.metadata?.paymentId) {
      this.logger.log('💰 Processing partial payment for event registration');

      try {
        const paymentId = session.metadata.paymentId;
        const paymentIntentId = session.payment_intent as string;

        // Get receipt URL from payment intent if available
        let receiptUrl: string | undefined;
        try {
          if (paymentIntentId) {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            receiptUrl = (paymentIntent as any).charges?.data?.[0]?.receipt_url;
          }
        } catch (error) {
          this.logger.warn('Could not retrieve receipt URL:', error);
        }

        // Import EventPartialPaymentService dynamically to avoid circular dependency
        const { EventPartialPaymentService } = await import('../../event/event-partial-payment.service');
        const partialPaymentService = this.moduleRef.get(EventPartialPaymentService, { strict: false });

        if (partialPaymentService) {
          await partialPaymentService.processSuccessfulPayment(
            paymentId,
            paymentIntentId,
            receiptUrl,
          );
          this.logger.log(`✅ Partial payment processed: ${paymentId}`);
        } else {
          this.logger.error('EventPartialPaymentService not found');
        }
      } catch (error) {
        this.logger.error('Error processing partial payment:', error);
      }
      return;
    }

    // Handle VIP event registration
    if (session.metadata?.eventId && session.metadata?.isVip === 'true') {
      await this.eventRegistrationsService.create({
        eventId: session.metadata.eventId,
        firstName: session.metadata.firstName,
        lastName: session.metadata.lastName,
        email: session.metadata.email,
        phoneNumber: session.metadata.phoneNumber,
        promoCode: session.metadata.promoCode,
        isVip: true,
        paymentStatus: 'paid',
      });

      this.logger.log(
        `✅ VIP registration completed for ${session.metadata.email}`,
      );
      return;
    }

    // Handle event registration update (adding attendees)
    if (
      session.metadata?.type === 'event_registration_update' &&
      session.metadata?.updateType === 'add_attendees'
    ) {
      const {
        registrationId,
        additionalAdults,
        additionalChildren,
        paymentMethod: regPaymentMethod,
      } = session.metadata;

      const amount = session.amount_total ? session.amount_total / 100 : 0;

      // Update the registration with new attendees
      await this.eventRegistrationsService.updateRegistrationAttendees(
        registrationId,
        parseInt(additionalAdults, 10),
        parseInt(additionalChildren, 10),
        amount,
        session.id,
      );

      this.logger.log(
        `✅ Registration updated for ${registrationId} with ${additionalAdults} adults and ${additionalChildren} children`,
      );
      return;
    }

    // Handle general event registration (NEW)
    if (session.metadata?.eventRegistration === 'true') {
      await this.handleEventRegistration(session);
      return;
    }

    // Handle classes purchase
    if (session.metadata?.type === 'classes_purchase') {
      await this.handleClassesPurchase(session);
      return;
    }

    if (!userId || !plan) {
      this.logger.warn('⚠️ Missing userId or plan.');
      return;
    }

    let expirationDate: Date | undefined;
    let nextBillingDate: Date | undefined;
    const billingCycle =
      (session.metadata?.billingCycle as BillingCycle) || BillingCycle.ONE_TIME;

    // Set expiration dates based on plan type
    if (plan === SubscriptionPlan.PEACE_WITH_MONEY) {
      // 60-day fixed access
      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 60);
    } else if (plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL) {
      // 7-day manual renewal
      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
    } else if (plan === SubscriptionPlan.CLASSES) {
      // 15-day fixed access for Classes
      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 15);
    } else if (
      plan === SubscriptionPlan.LIVE_WEEKLY_RECURRING &&
      subscriptionId
    ) {
      // Weekly recurring - set next billing date
      nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    }

    // Extract pricing information from metadata
    const originalPrice = parseFloat(
      session.metadata?.originalPrice || amount.toString(),
    );
    const finalPrice = parseFloat(
      session.metadata?.finalPrice || amount.toString(),
    );
    const discount = parseFloat(session.metadata?.discount || '0');

    // Create transaction record
    const transaction = await this.transactionModel.create({
      userId,
      amount,
      currency,
      status:
        session.payment_status === 'paid'
          ? PaymentStatus.SUCCEEDED
          : PaymentStatus.PENDING,
      plan,
      subscriptionId: subscriptionId || undefined,
      stripeSessionId: session.id,
      stripeCustomerId: session.customer as string,
      paymentMethod: this.mapStripePaymentMethodType(paymentMethod),
      billingCycle,
      expiresAt: expirationDate,
      nextBillingDate,
      originalPrice,
      finalPrice,
      discountApplied: discount,
      metadata: {
        sessionMetadata: session.metadata,
        paymentIntentId: session.payment_intent,
      },
    });

    // Record subscription history
    await this.subscriptionHistoryModel.create({
      userId,
      transactionId: transaction._id,
      plan,
      action: SubscriptionAction.CREATED,
      stripeSubscriptionId: subscriptionId,
      stripeEventId: session.id,
      price: finalPrice,
      discountApplied: discount,
      currency,
      effectiveDate: new Date(),
      expirationDate,
      metadata: session.metadata,
    });

    // Get subscription details from Stripe if it's a recurring subscription
    let currentPeriodEnd = null;
    let subscriptionStatus = 'active';
    if (subscriptionId) {
      try {
        const stripeSubscription =
          await this.stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = new Date(
          stripeSubscription.current_period_end * 1000,
        );
        subscriptionStatus = stripeSubscription.status;
      } catch (error) {
        this.logger.error(
          `Failed to retrieve subscription ${subscriptionId}:`,
          error,
        );
      }
    }

    // ✅ FIXED: Atomic and idempotent subscription update (prevents duplicates)
    // ✅ FIXED: For recurring subscriptions, expiresAt should match currentPeriodEnd
    const { Types } = await import('mongoose');
    if (subscriptionId) {
      // For recurring subscriptions, use currentPeriodEnd as the authoritative expiration date
      // This ensures expiresAt and currentPeriodEnd stay in sync
      const effectiveExpiresAt = currentPeriodEnd || expirationDate;

      // For recurring subscriptions - use stripeSubscriptionId as unique key
      // First try to update existing subscription with same stripeSubscriptionId
      const updateResult = await this.userModel.updateOne(
        {
          _id: new Types.ObjectId(userId),
          'subscriptions.stripeSubscriptionId': subscriptionId,
        },
        {
          $set: {
            'subscriptions.$.plan': plan,
            'subscriptions.$.expiresAt': effectiveExpiresAt,
            'subscriptions.$.currentPeriodEnd': effectiveExpiresAt,
            'subscriptions.$.status': subscriptionStatus,
            'subscriptions.$.updatedAt': new Date(),
          },
          $addToSet: { activeSubscriptions: subscriptionId },
        },
      );

      if (updateResult.matchedCount === 0) {
        // Doesn't exist - add ONLY if stripeSubscriptionId not already present (prevents duplicates)
        await this.userModel.updateOne(
          {
            _id: new Types.ObjectId(userId),
            'subscriptions.stripeSubscriptionId': { $ne: subscriptionId },
          },
          {
            $push: {
              subscriptions: {
                plan,
                expiresAt: effectiveExpiresAt,
                stripeSubscriptionId: subscriptionId,
                createdAt: new Date(),
                currentPeriodEnd: effectiveExpiresAt,
                status: subscriptionStatus,
              },
            },
            $addToSet: { activeSubscriptions: subscriptionId },
          },
        );
      }
    } else {
      // For one-time purchases - use plan as unique key (replace existing)
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $pull: { subscriptions: { plan: plan } },
        },
      );
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $push: {
            subscriptions: {
              plan,
              expiresAt: expirationDate,
              stripeSubscriptionId: null,
              createdAt: new Date(),
              currentPeriodEnd: currentPeriodEnd || expirationDate,
              status: subscriptionStatus,
            },
          },
        },
      );
    }

    this.logger.log(
      `✅ User ${userId} subscribed to ${plan} (Expires: ${expirationDate || 'Never'})`,
    );

    // Send payment confirmation email
    try {
      const user = await this.userService.findById(userId);
      if (user) {
        // Get plan name for email
        const planNames: Record<string, string> = {
          [SubscriptionPlan.LIVE_WEEKLY_MANUAL]: 'Live Semanal',
          [SubscriptionPlan.LIVE_WEEKLY_RECURRING]: 'Live Semanal Auto',
          [SubscriptionPlan.MASTER_CLASES]: 'Master Clases',
          [SubscriptionPlan.LIVE_RECORDED]: 'Live Grabados',
          [SubscriptionPlan.PSICOTRADING]: 'PsicoTrading',
          [SubscriptionPlan.CLASSES]: 'Clases',
          [SubscriptionPlan.PEACE_WITH_MONEY]: 'Paz con el Dinero',
          [SubscriptionPlan.MASTER_COURSE]: 'Master Course',
          [SubscriptionPlan.STOCKS]: 'Acciones',
          [SubscriptionPlan.COMMUNITY_EVENT]: 'Community Event',
          [SubscriptionPlan.VIP_EVENT]: 'VIP Event',
        };

        const isRecurring = [
          SubscriptionPlan.LIVE_WEEKLY_RECURRING,
          SubscriptionPlan.MASTER_CLASES,
          SubscriptionPlan.LIVE_RECORDED,
          SubscriptionPlan.PSICOTRADING,
          SubscriptionPlan.STOCKS,
        ].includes(plan);

        await this.emailService.sendPaymentConfirmationEmail(user.email, {
          firstName: user.firstName,
          planName: planNames[plan] || plan,
          amount: finalPrice,
          currency,
          billingCycle,
          transactionId: transaction._id.toString(),
          nextBillingDate,
          expiresAt: expirationDate,
          isRecurring,
        });
      }
    } catch (error) {
      this.logger.error('Failed to send payment confirmation email:', error);
    }
  }

  // Helper method to map Stripe payment method types to our enum
  private mapStripePaymentMethodType(stripeType: string): PaymentMethod {
    const mapping: Record<string, PaymentMethod> = {
      card: PaymentMethod.CARD,
      klarna: PaymentMethod.KLARNA,
      afterpay_clearpay: PaymentMethod.AFTERPAY,
      affirm: PaymentMethod.AFFIRM,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
    };
    return mapping[stripeType] || PaymentMethod.CARD;
  }

  // ✅ **Handle Recurring Payments - ENHANCED VERSION**
  private async handleRecurringPayment(invoice: Stripe.Invoice) {
    this.logger.log(`🔄 Processing RECURRING PAYMENT for invoice: ${invoice.id}`);
    this.logger.log(`   Billing reason: ${invoice.billing_reason}`);
    this.logger.log(`   Customer ID: ${invoice.customer}`);
    this.logger.log(`   Subscription ID: ${invoice.subscription}`);
    this.logger.log(`   Amount paid: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);
    
    const customerId = invoice.customer as string;
    
    // Check if this is an installment plan payment
    if (invoice.subscription_details?.metadata?.isInstallmentPlan === 'true') {
      this.logger.log('Processing installment plan payment');
      return;
    }
    
    const user = await this.userService.findByStripeCustomerId(customerId);

    if (!user) {
      this.logger.error(`❌ CRITICAL: No user found for Stripe customer: ${customerId}`);
      this.logger.error(`   Invoice ID: ${invoice.id}`);
      this.logger.error(`   Subscription ID: ${invoice.subscription}`);
      
      if (invoice.customer_email) {
        this.logger.error(`   Customer email from invoice: ${invoice.customer_email}`);
        const userByEmail = await this.userService.findByEmail(invoice.customer_email);
        if (userByEmail) {
          this.logger.error(`   ⚠️ Found user by email but stripeCustomerId doesn't match!`);
        }
      }
      return;
    }

    const amountPaid = invoice.amount_paid / 100;
    const currency = invoice.currency;
    const invoiceId = invoice.id;
    const subscriptionId = invoice.subscription as string;

    // Check if already processed
    const existingTransaction = await this.transactionModel.findOne({
      stripePaymentIntentId: invoice.payment_intent as string,
    });

    if (existingTransaction) {
      this.logger.warn(`⚠️ Invoice ${invoiceId} already processed`);
      return;
    }

    // Get subscription metadata to determine plan
    let plan: SubscriptionPlan = SubscriptionPlan.MASTER_CLASES;
    let billingCycle: BillingCycle = BillingCycle.MONTHLY;

    if (invoice.lines?.data?.[0]?.metadata) {
      const lineMetadata = invoice.lines.data[0].metadata;
      if (lineMetadata.plan) {
        plan = lineMetadata.plan as SubscriptionPlan;
      }
    } else if (invoice.subscription_details?.metadata) {
      plan = (invoice.subscription_details.metadata.plan as SubscriptionPlan) ||
        SubscriptionPlan.MASTER_CLASES;
      billingCycle = (invoice.subscription_details.metadata.billingCycle as BillingCycle) ||
        BillingCycle.MONTHLY;
    } else if (subscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.metadata?.plan) {
          plan = subscription.metadata.plan as SubscriptionPlan;
          billingCycle = (subscription.metadata.billingCycle as BillingCycle) ||
            BillingCycle.MONTHLY;
        }
      } catch (error) {
        this.logger.error(`Error fetching subscription ${subscriptionId}:`, error);
      }
    }

    // Calculate the current period end
    let currentPeriodEnd: Date;
    if (invoice.lines?.data?.[0]?.period?.end) {
      currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1000);
    } else if (invoice.period_end) {
      currentPeriodEnd = new Date(invoice.period_end * 1000);
    } else {
      currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 7);
    }

    // Create transaction record
    const transaction = await this.transactionModel.create({
      userId: user._id,
      amount: amountPaid,
      currency,
      status: PaymentStatus.SUCCEEDED,
      plan,
      type: TransactionType.SUBSCRIPTION_PAYMENT,
      subscriptionId,
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeCustomerId: customerId,
      paymentMethod: PaymentMethod.CARD,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
      },
      receiptUrl: invoice.hosted_invoice_url,
      invoiceUrl: invoice.invoice_pdf,
      billingCycle,
      nextBillingDate: currentPeriodEnd,
    });

    // Record subscription history
    await this.subscriptionHistoryModel.create({
      userId: user._id,
      transactionId: transaction._id,
      plan,
      action: SubscriptionAction.RENEWED,
      stripeSubscriptionId: subscriptionId,
      stripeEventId: invoiceId,
      price: amountPaid,
      currency,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
      },
      effectiveDate: new Date(),
    });

    this.logger.log(`📅 Updating subscription for user ${user.email} (${user._id})`);
    this.logger.log(`   Subscription ID: ${subscriptionId}`);
    this.logger.log(`   New Period End: ${currentPeriodEnd.toISOString()}`);

    // ENHANCED UPDATE METHOD - Use atomic operations with positional operator
    try {
      // Method 1: Try to update existing subscription with positional operator
      const updateResult = await this.userModel.updateOne(
        { 
          _id: user._id,
          'subscriptions.stripeSubscriptionId': subscriptionId 
        },
        {
          $set: {
            'subscriptions.$.currentPeriodEnd': currentPeriodEnd,
            'subscriptions.$.expiresAt': currentPeriodEnd,
            'subscriptions.$.status': 'active',
            'subscriptions.$.plan': plan,
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        this.logger.log(`✅ Successfully updated subscription using positional operator`);
      } else if (updateResult.matchedCount === 0) {
        // Method 2: If no match found, the subscription might not exist, add it
        // ✅ FIXED: Only add if stripeSubscriptionId not already present (prevents duplicates)
        this.logger.warn(`Subscription ${subscriptionId} not found, adding new subscription`);

        const addResult = await this.userModel.updateOne(
          {
            _id: user._id,
            'subscriptions.stripeSubscriptionId': { $ne: subscriptionId }  // Only if not exists!
          },
          {
            $push: {
              subscriptions: {
                plan,
                stripeSubscriptionId: subscriptionId,
                currentPeriodEnd: currentPeriodEnd,
                expiresAt: currentPeriodEnd,
                status: 'active',
                createdAt: new Date()
              }
            },
            $addToSet: {
              activeSubscriptions: subscriptionId
            }
          }
        );

        if (addResult.modifiedCount > 0) {
          this.logger.log(`✅ Added new subscription successfully`);
        } else {
          this.logger.log(`Subscription ${subscriptionId} already exists, skipping add`);
        }
      } else {
        // Method 3: Fallback - Replace entire subscriptions array
        this.logger.warn(`Update didn't modify, trying full replacement`);
        
        const freshUser = await this.userModel.findById(user._id);
        if (freshUser) {
          const updatedSubs = freshUser.subscriptions.map(sub => {
            if (sub.stripeSubscriptionId === subscriptionId) {
              return {
                plan: sub.plan || plan,
                stripeSubscriptionId: sub.stripeSubscriptionId,
                currentPeriodEnd,
                expiresAt: currentPeriodEnd,
                status: 'active',
                createdAt: sub.createdAt
              };
            }
            return {
              plan: sub.plan,
              stripeSubscriptionId: sub.stripeSubscriptionId,
              currentPeriodEnd: sub.currentPeriodEnd,
              expiresAt: sub.expiresAt,
              status: sub.status,
              createdAt: sub.createdAt
            };
          });

          // If subscription wasn't found, add it
          if (!updatedSubs.some(s => s.stripeSubscriptionId === subscriptionId)) {
            updatedSubs.push({
              plan,
              stripeSubscriptionId: subscriptionId,
              currentPeriodEnd,
              expiresAt: currentPeriodEnd,
              status: 'active',
              createdAt: new Date()
            });
          }

          const replaceResult = await this.userModel.updateOne(
            { _id: user._id },
            { 
              $set: { 
                subscriptions: updatedSubs,
                updatedAt: new Date()
              }
            }
          );

          if (replaceResult.modifiedCount > 0) {
            this.logger.log(`✅ Successfully updated subscription using full replacement`);
          }
        }
      }

      // Verify the update
      const verifyUser = await this.userModel.findById(user._id);
      const updatedSub = verifyUser?.subscriptions.find(s => s.stripeSubscriptionId === subscriptionId);
      
      if (updatedSub) {
        this.logger.log(`✅ Verification: Subscription updated successfully`);
        this.logger.log(`   Current Period End: ${updatedSub.currentPeriodEnd}`);
      } else {
        this.logger.error(`❌ Verification Failed: Subscription not found after update`);
      }

    } catch (error) {
      this.logger.error(`❌ Error updating subscription:`, error);
      
      // Last resort: Try direct MongoDB operation
      try {
        const db = this.userModel.db;
        const result = await db.collection('users').findOneAndUpdate(
          { 
            _id: user._id,
            'subscriptions.stripeSubscriptionId': subscriptionId
          },
          {
            $set: {
              'subscriptions.$.currentPeriodEnd': currentPeriodEnd,
              'subscriptions.$.expiresAt': currentPeriodEnd,
              'subscriptions.$.status': 'active'
            }
          },
          { returnDocument: 'after' }
        );
        
        if (result) {
          this.logger.log(`✅ Updated using direct MongoDB operation`);
        }
      } catch (dbError) {
        this.logger.error(`❌ Direct MongoDB update also failed:`, dbError);
      }
    }

    // Also ensure activeSubscriptions array includes this subscription
    if (!user.activeSubscriptions.includes(subscriptionId)) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $addToSet: { activeSubscriptions: subscriptionId } }
      );
    }

    this.logger.log(`✅ Recurring payment fully processed for user ${user._id}`);
  }

  // ✅ **Handle Subscription Cancellation**
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);

    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    const subscriptionId = subscription.id;
    const userSubscription = user.subscriptions.find((sub) =>
      user.activeSubscriptions.includes(subscriptionId),
    );

    if (!userSubscription) {
      this.logger.warn(`⚠️ No active subscription found for user ${user._id}`);
      return;
    }

    // ✅ Set expiration date instead of immediate removal
    userSubscription.expiresAt = new Date();
    userSubscription.expiresAt.setMonth(
      userSubscription.expiresAt.getMonth() + 1,
    ); // Keep access until end of cycle

    await this.userService.updateUser(user._id.toString(), {
      subscriptions: user.subscriptions,
      $pull: { activeSubscriptions: subscriptionId },
    });

    this.logger.log(
      `⚠️ Subscription ${subscriptionId} for user ${user._id} will expire on ${userSubscription.expiresAt}`,
    );
  }

  // ✅ **Map Stripe `priceId` to SubscriptionPlan Enum**
  private async mapPriceIdToPlan(
    priceId: string,
  ): Promise<SubscriptionPlan | null> {
    // Try to find the plan in database first
    try {
      const environment = this.configService.get<string>(
        'NODE_ENV',
        'development',
      );
      const query =
        environment === 'production'
          ? { 'stripeIds.production.priceId': priceId }
          : { 'stripeIds.development.priceId': priceId };

      const plan = await this.subscriptionPlanModel.findOne(query).exec();
      if (plan) {
        return plan.planId as SubscriptionPlan;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to find plan for price ID ${priceId} in database`,
      );
    }

    // Fallback to hardcoded mapping (to be removed once database is confirmed working)
    const priceToPlanMap: { [key: string]: SubscriptionPlan } = {
      /* These are Dev subscriptions */
      // Community Subscriptions
      price_1Rj37aJ1acFkbhNI6psETNkH: SubscriptionPlan.LIVE_WEEKLY_MANUAL,
      price_1Rj383J1acFkbhNIO3TfFmnl: SubscriptionPlan.LIVE_WEEKLY_RECURRING,

      // Recurring Monthly
      price_1Rk7OOJ1acFkbhNI1JAr62Lw: SubscriptionPlan.MASTER_CLASES,
      price_1Rk7PoJ1acFkbhNInNuVejrp: SubscriptionPlan.LIVE_RECORDED,
      price_1RNIS6J1acFkbhNIyPeQVOAS: SubscriptionPlan.PSICOTRADING,
      price_TODO_STOCKS: SubscriptionPlan.STOCKS, // TODO: Replace with actual Stripe price ID

      // One-Time Purchases
      price_1Rk6VVJ1acFkbhNIGFGK4mzA: SubscriptionPlan.CLASSES,
      price_1RX2hDJ1acFkbhNIq4mDa1Js: SubscriptionPlan.PEACE_WITH_MONEY,
      price_1Rj38bJ1acFkbhNID7qBD4lz: SubscriptionPlan.MASTER_COURSE,
      price_1RjVpqJ1acFkbhNIGH06m1RA: SubscriptionPlan.COMMUNITY_EVENT,
      price_1RJKtNJ1acFkbhNIBNsLFT4p: SubscriptionPlan.VIP_EVENT,

      /* These are Prod subscriptions */
      // // Community Subscriptions
      // price_1Rj37aJ1acFkbhNI6psETNkH: SubscriptionPlan.LIVE_WEEKLY_MANUAL, // TODO: Create in Stripe
      // price_1Rj383J1acFkbhNIO3TfFmnl: SubscriptionPlan.LIVE_WEEKLY_RECURRING, // TODO: Create in Stripe

      // // Recurring Monthly
      // price_TODO_MASTER_CLASES: SubscriptionPlan.MASTER_CLASES, // TODO: Create in Stripe
      // price_1R5bWkJ1acFkbhNIFMuDqkMj: SubscriptionPlan.LIVE_RECORDED, // Using existing CLASS price
      // price_1RNIS6J1acFkbhNIyPeQVOAS: SubscriptionPlan.PSICOTRADING,

      // // One-Time Purchases
      // price_TODO_CLASSES: SubscriptionPlan.CLASSES, // TODO: Create in Stripe
      // price_1RX5z8E0taYR7njRaC7mXbqn: SubscriptionPlan.PEACE_WITH_MONEY, // Using existing MONEYPEACE price
      // price_1Rj38bJ1acFkbhNID7qBD4lz: SubscriptionPlan.MASTER_COURSE,
      // price_1RjVpqJ1acFkbhNIGH06m1RA: SubscriptionPlan.COMMUNITY_EVENT,
    };

    return priceToPlanMap[priceId] || null;
  }

  /**
   * Get subscription details for a user
   */
  async getSubscriptionDetails(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscriptionDetails = await Promise.all(
      user.activeSubscriptions.map(async (subId) => {
        try {
          const subscription = await this.stripe.subscriptions.retrieve(subId);
          return {
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            items: subscription.items.data.map((item) => ({
              id: item.id,
              price: item.price,
              quantity: item.quantity,
            })),
          };
        } catch (error) {
          this.logger.error(`Error fetching subscription ${subId}:`, error);
          return null;
        }
      }),
    );

    return {
      user: {
        id: user._id,
        email: user.email,
        subscriptions: user.subscriptions,
      },
      stripeSubscriptions: subscriptionDetails.filter((s) => s !== null),
    };
  }

  /**
   * Create customer portal session for subscription management
   */
  async createCustomerPortalSession(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure user has a Stripe customer ID
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user._id.toString() },
      });
      customerId = customer.id;

      await this.userService.updateUser(userId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get<string>('FRONTEND_URL')}/dashboard/account`,
    });

    return { url: session.url };
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string, limit: number = 10) {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return transactions.map((tx) => ({
      id: tx._id,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      plan: tx.plan,
      createdAt: tx.createdAt,
      receiptUrl: tx.receiptUrl,
      invoiceUrl: tx.invoiceUrl,
    }));
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(
    userId: string,
    currentPlan: SubscriptionPlan,
    newPriceId: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = user.activeSubscriptions.find(() =>
      user.subscriptions.some((sub) => sub.plan === currentPlan),
    );

    if (!subscription) {
      throw new NotFoundException('No active subscription found for this plan');
    }

    try {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(subscription);
      const subscriptionItem = stripeSubscription.items.data[0];

      // Update the subscription with the new price
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription,
        {
          items: [
            {
              id: subscriptionItem.id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'create_prorations',
        },
      );

      // Update the user's subscription plan
      const newPlan = await this.mapPriceIdToPlan(newPriceId);
      if (newPlan) {
        user.subscriptions = user.subscriptions.map((sub) =>
          sub.plan === currentPlan ? { ...sub, plan: newPlan } : sub,
        );

        await this.userService.updateUser(userId, {
          subscriptions: user.subscriptions,
        });
      }

      return {
        success: true,
        subscription: updatedSubscription,
      };
    } catch (error) {
      this.logger.error('Error updating subscription:', error);
      throw new InternalServerErrorException('Failed to update subscription');
    }
  }

  async cancelSubscription(
    userId: string,
    subscriptionPlan: SubscriptionPlan,
    forceNow: boolean = false,
  ): Promise<any> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ FIXED: Find subscription object first, then get its stripeSubscriptionId
    const subscription = user.subscriptions.find(
      (sub) => sub.plan === subscriptionPlan,
    );

    if (!subscription) {
      throw new NotFoundException(`No subscription found for plan: ${subscriptionPlan}`);
    }

    const subscriptionId = subscription.stripeSubscriptionId;

    if (!subscriptionId) {
      // Handle one-time purchases without Stripe ID - just update local data
      this.logger.warn(
        `Subscription ${subscriptionPlan} has no Stripe ID - updating local data only`,
      );

      await this.userModel.updateOne(
        { _id: user._id },
        {
          $pull: { subscriptions: { plan: subscriptionPlan } },
        },
      );

      return await this.userService.findById(userId);
    }

    try {
      // ✅ Cancel the subscription in Stripe
      await this.stripe.subscriptions.cancel(subscriptionId);

      // ✅ Update subscription expiration date (instead of removing it immediately)
      const now = new Date();
      const expiresAt = forceNow ? now : getLastDayOfMonth();
      user.subscriptions = user.subscriptions.map((sub) =>
        sub.plan === subscriptionPlan
          ? { ...sub, expiresAt } // ✅ Expire at the last day of the current month
          : sub,
      );

      await this.userService.updateUser(userId, {
        subscriptions: user.subscriptions,
        $pull: { activeSubscriptions: subscriptionId }, // ✅ Remove from active subs
      });

      this.logger.log(
        `✅ Subscription ${subscriptionPlan} canceled for user ${userId}`,
      );

      return await this.userService.findById(userId);
    } catch (error) {
      this.logger.error('Error canceling subscription:', error.message);
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  // ✅ **Handle Subscription Updated**
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    this.logger.log(
      `Processing subscription.updated event for ${subscription.id}`,
    );

    const customerId = subscription.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);

    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    // Get the plan from metadata
    const plan = subscription.metadata?.plan as SubscriptionPlan;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const status = subscription.status;

    // Update the user's subscription data
    const userSubscriptions = user.subscriptions.map((sub) => {
      if (sub.stripeSubscriptionId === subscription.id) {
        this.logger.log(
          `Updating subscription ${subscription.id} - Status: ${status}, Period End: ${currentPeriodEnd}`,
        );
        return {
          ...sub,
          plan: plan || sub.plan,
          currentPeriodEnd: currentPeriodEnd,
          expiresAt: currentPeriodEnd, // Keep both dates in sync
          status: status,
        };
      }
      return sub;
    });

    // Check if subscription exists, if not add it
    const subscriptionExists = userSubscriptions.some(
      sub => sub.stripeSubscriptionId === subscription.id
    );

    if (!subscriptionExists && plan) {
      this.logger.log(
        `Adding new subscription ${subscription.id} for plan ${plan}`,
      );
      userSubscriptions.push({
        plan: plan,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: currentPeriodEnd,
        expiresAt: currentPeriodEnd,
        status: status,
        createdAt: new Date(),
      });
    }

    // Update user subscriptions
    await this.userService.updateUser(user._id.toString(), {
      subscriptions: userSubscriptions,
    });

    // Check if plan changed and record it
    if (plan) {
      const previousPlan = user.subscriptions.find((sub) =>
        sub.stripeSubscriptionId === subscription.id
      )?.plan;

      if (previousPlan && previousPlan !== plan) {
        // Record plan change
        await this.subscriptionHistoryModel.create({
          userId: user._id.toString(),
          plan,
          previousPlan,
          action: SubscriptionAction.UPGRADED, // Or DOWNGRADED based on plan comparison
          stripeSubscriptionId: subscription.id,
          price: subscription.items.data[0].price.unit_amount / 100,
          currency: subscription.currency,
          effectiveDate: new Date(),
        });
      }
    }

    this.logger.log(
      `✅ Subscription ${subscription.id} updated for user ${user._id}`,
    );
  }

  // ✅ **Handle Payment Failed**
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.log(
      `Processing invoice.payment_failed event for ${invoice.id}`,
    );

    const customerId = invoice.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);

    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    // Create failed transaction record
    await this.transactionModel.create({
      userId: user._id.toString(),
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      plan:
        (invoice.subscription_details?.metadata?.plan as SubscriptionPlan) ||
        SubscriptionPlan.MASTER_CLASES,
      subscriptionId: invoice.subscription as string,
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeCustomerId: customerId,
      paymentMethod: PaymentMethod.CARD,
      failureReason: 'Payment failed on invoice',
      metadata: {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      },
    });

    // Record in subscription history
    await this.subscriptionHistoryModel.create({
      userId: user._id.toString(),
      plan:
        (invoice.subscription_details?.metadata?.plan as SubscriptionPlan) ||
        SubscriptionPlan.MASTER_CLASES,
      action: SubscriptionAction.PAYMENT_FAILED,
      stripeSubscriptionId: invoice.subscription as string,
      stripeEventId: invoice.id,
      price: invoice.amount_due / 100,
      currency: invoice.currency,
      effectiveDate: new Date(),
      metadata: {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      },
    });

    this.logger.warn(
      `⚠️ Payment failed for user ${user._id} - Invoice: ${invoice.id}`,
    );
  }

  // ✅ **Handle Payment Intent Failed**
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(
      `Processing payment_intent.payment_failed event for ${paymentIntent.id}`,
    );

    // Try to find existing transaction
    const transaction = await this.transactionModel.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (transaction) {
      // Update transaction status
      transaction.status = PaymentStatus.FAILED;
      transaction.failureReason =
        paymentIntent.last_payment_error?.message || 'Payment failed';
      await transaction.save();

      this.logger.warn(
        `⚠️ Payment intent ${paymentIntent.id} failed - Transaction updated`,
      );
    } else {
      this.logger.warn(
        `⚠️ No transaction found for payment intent ${paymentIntent.id}`,
      );
    }
  }

  /**
   * Get checkout session details (for success page)
   */
  async getCheckoutSessionUrl(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return { url: session.url };
    } catch (error) {
      this.logger.error('Error retrieving checkout session URL:', error);
      throw new NotFoundException('Checkout session not found');
    }
  }

  async getCheckoutSession(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer', 'subscription', 'payment_intent'],
      });

      // Get user from metadata or customer
      let user = null;
      if (session.metadata?.userId) {
        user = await this.userService.findById(session.metadata.userId);
      } else if (session.customer) {
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;
        user = await this.userService.findByStripeCustomerId(customerId);
      }

      // Get client secret from payment intent
      let clientSecret = null;
      if (
        session.payment_intent &&
        typeof session.payment_intent === 'object'
      ) {
        clientSecret = session.payment_intent.client_secret;
      }

      return {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email || user?.email,
        amount_total: session.amount_total,
        amountTotal: session.amount_total / 100,
        currency: session.currency,
        metadata: session.metadata,
        subscription: session.subscription,
        mode: session.mode,
        client_secret: clientSecret,
        payment_intent: session.payment_intent,
        user: user
          ? {
              id: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            }
          : null,
      };
    } catch (error) {
      this.logger.error('Error retrieving checkout session:', error);
      throw new NotFoundException('Checkout session not found');
    }
  }

  /**
   * Get subscription history for a user
   */
  async getSubscriptionHistory(userId: string, limit: number = 20) {
    const history = await this.subscriptionHistoryModel
      .find({ userId })
      .populate('transactionId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return history.map((record) => ({
      id: record._id,
      plan: record.plan,
      previousPlan: record.previousPlan,
      action: record.action,
      price: record.price,
      previousPrice: record.previousPrice,
      discountApplied: record.discountApplied,
      currency: record.currency,
      cancellationReason: record.cancellationReason,
      cancellationNote: record.cancellationNote,
      effectiveDate: record.effectiveDate,
      expirationDate: record.expirationDate,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Get available BNPL (Buy Now Pay Later) methods based on amount and currency
   * @param amount Payment amount in the currency's base unit
   * @param currency Currency code (e.g., 'usd', 'eur')
   * @param isRecurring Whether this is a recurring payment
   * @returns Array of BNPL payment method strings
   */
  private getBNPLMethods(
    amount: number,
    currency: string,
    isRecurring: boolean = false,
  ): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    const bnplMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      [];

    // Check if BNPL is enabled via environment variable
    const bnplEnabled =
      this.configService.get<string>('STRIPE_BNPL_ENABLED', 'true') === 'true';
    if (!bnplEnabled) {
      this.logger.debug('BNPL methods disabled via configuration');
      return bnplMethods;
    }

    // BNPL methods are generally not available for subscriptions
    if (isRecurring) {
      return bnplMethods;
    }

    // Currency must be lowercase for Stripe
    const lowerCurrency = currency.toLowerCase();

    // Klarna availability
    // Minimum: $1 USD, Maximum: $10,000 USD
    // Available in: USD, EUR, GBP, SEK, NOK, DKK, and more
    if (
      [
        'usd',
        'eur',
        'gbp',
        'sek',
        'nok',
        'dkk',
        'chf',
        'aud',
        'nzd',
        'cad',
        'pln',
        'czk',
      ].includes(lowerCurrency)
    ) {
      if (lowerCurrency === 'usd' && amount >= 1 && amount <= 10000) {
        bnplMethods.push(
          'klarna' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      } else if (lowerCurrency === 'eur' && amount >= 1 && amount <= 10000) {
        bnplMethods.push(
          'klarna' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      } else if (amount >= 1 && amount <= 15000) {
        // Other currencies have different limits
        bnplMethods.push(
          'klarna' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      }
    }

    // Afterpay/Clearpay availability
    // Minimum: $1 USD, Maximum: $4,000 USD (updated based on account limits)
    // Available in: USD, CAD, GBP, AUD, NZD, EUR
    if (['usd', 'cad', 'gbp', 'aud', 'nzd', 'eur'].includes(lowerCurrency)) {
      if (lowerCurrency === 'usd' && amount >= 1 && amount <= 4000) {
        bnplMethods.push(
          'afterpay_clearpay' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      } else if (lowerCurrency === 'aud' && amount >= 1 && amount <= 2000) {
        bnplMethods.push(
          'afterpay_clearpay' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      } else if (amount >= 1 && amount <= 1000) {
        // Other currencies typically have lower limits
        bnplMethods.push(
          'afterpay_clearpay' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
        );
      }
    }

    // Affirm availability (US only)
    // Minimum: $50 USD, Maximum: $30,000 USD
    if (lowerCurrency === 'usd' && amount >= 50 && amount <= 30000) {
      bnplMethods.push(
        'affirm' as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      );
    }

    if (bnplMethods.length > 0) {
      this.logger.debug(
        `BNPL methods available for ${amount} ${currency}: ${bnplMethods.join(', ')}`,
      );
    }

    return bnplMethods;
  }

  async createRefund(params: {
    paymentIntentId: string;
    amount: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        reason: params.reason || 'requested_by_customer',
        metadata: params.metadata || {},
      });
      return refund;
    } catch (error) {
      this.logger.error('Failed to create refund:', error);
      throw error;
    }
  }
}
