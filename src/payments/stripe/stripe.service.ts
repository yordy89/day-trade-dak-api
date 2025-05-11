import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Stripe from 'stripe';
import { Transaction } from './transaction.schema';
import { Model } from 'mongoose';
import { UserService } from 'src/users/users.service';
import { SubscriptionPlan } from 'src/users/user.dto';
import { getLastDayOfMonth } from 'src/helpers/date';
import { EventRegistrationsService } from 'src/event/event-registration.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private eventRegistrationsService: EventRegistrationsService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  // ✅ **Create Checkout Session**
  async createCheckoutSession(userId: string, priceId: string) {
    const price = await this.stripe.prices.retrieve(priceId);
    const isRecurring = price.recurring !== null;
    const subscriptionPlan = this.mapPriceIdToPlan(priceId);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: isRecurring ? 'subscription' : 'payment',
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/dashboard/subscription/success?subscription=${subscriptionPlan}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/dashboard/subscription/plans`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, priceId }, // ✅ Store userId & priceId
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

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      discounts: promotionCodeId
        ? [{ promotion_code: promotionCodeId }]
        : undefined,
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/events/thank-you`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/events/${eventId}`,
      customer_email: email,
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

  // ✅ **Handle Webhook Events**
  async handleWebhookEvent(signature: string, rawBody: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error('⚠️ Webhook verification failed.', err.message);
      throw new Error('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.payment_succeeded':
        await this.handleRecurringPayment(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        this.logger.warn(`ℹ️ Unhandled event type: ${event.type}`);
    }
  }

  // ✅ **Handle First-Time Checkout Completion**
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const priceId = session.metadata?.priceId;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const currency = session.currency || 'usd';
    const subscriptionId = session.subscription as string;

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

    if (!userId || !priceId) {
      this.logger.warn('⚠️ Missing userId or priceId.');
      return;
    }

    const subscriptionPlan = this.mapPriceIdToPlan(priceId);
    if (!subscriptionPlan) {
      this.logger.warn(`⚠️ Unknown priceId: ${priceId}`);
      return;
    }

    let expirationDate: Date | undefined;

    if (!subscriptionId) {
      // ✅ Check if the user already has a transaction for this plan
      const existingTransaction = await this.transactionModel.findOne({
        userId,
        plan: subscriptionPlan,
      });

      if (existingTransaction) {
        this.logger.warn(
          `⚠️ User ${userId} already has a transaction for ${subscriptionPlan}, skipping duplicate.`,
        );
        return;
      }

      // ✅ One-time purchase, set expiration date
      const priceDetails = await this.stripe.prices.retrieve(priceId);
      const productDetails = await this.stripe.products.retrieve(
        priceDetails.product as string,
      );

      if (priceDetails.recurring) {
        this.logger.warn(
          `⚠️ Expected a one-time price, but got a recurring price.`,
        );
        return;
      }

      const expirationDays = parseInt(
        productDetails.metadata?.expiration_days || '30',
        10,
      );
      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
    }

    // ✅ Store transaction only if it does not exist
    await this.transactionModel.create({
      userId,
      amount,
      currency,
      status: session.payment_status || 'unknown',
      plan: subscriptionPlan,
      subscriptionId: subscriptionId || undefined,
      expiresAt: expirationDate, // ✅ Only for fixed-term plans
    });

    // ✅ Ensure Subscription is Updated in the User Object
    // ✅ First, remove any existing subscription entry for the same plan
    await this.userService.updateUser(userId, {
      $pull: { subscriptions: { plan: subscriptionPlan } }, // ✅ Removes any existing subscription for the same plan
    });

    // ✅ Second, add the new subscription entry
    await this.userService.updateUser(userId, {
      $push: {
        subscriptions: { plan: subscriptionPlan, expiresAt: expirationDate }, // ✅ Adds the new subscription
      },

      ...(subscriptionId
        ? { $addToSet: { activeSubscriptions: subscriptionId } } // ✅ Adds to active subscriptions if recurring
        : {}),
    });

    this.logger.log(
      `✅ User ${userId} subscribed to ${subscriptionPlan} (Expires: ${expirationDate || 'Never'})`,
    );
  }

  // ✅ **Handle Recurring Payments**
  private async handleRecurringPayment(invoice: Stripe.Invoice) {
    console.log('Invoice:', invoice);
    const customerId = invoice.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);

    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    const amountPaid = invoice.amount_paid / 100;
    const currency = invoice.currency;
    const invoiceId = invoice.id;

    // ✅ Ensure the invoice does not already exist
    const existingTransaction = await this.transactionModel.findOne({
      stripeSessionId: invoiceId,
    });

    if (existingTransaction) {
      this.logger.warn(`⚠️ Invoice ${invoiceId} already processed`);
      return;
    }

    // ✅ Create new transaction for the recurring payment
    await this.transactionModel.create({
      userId: user._id.toString(),
      amount: amountPaid,
      currency,
      status: 'paid',
      stripeSessionId: invoiceId,
    });

    this.logger.log(`✅ Recurring payment recorded for user ${user._id}`);
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
    const userSubscription = user.subscriptions.find(() =>
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
  private mapPriceIdToPlan(priceId: string): SubscriptionPlan | null {
    const priceToPlanMap: { [key: string]: SubscriptionPlan } = {
      price_1Qz2KuE0taYR7njR00NmGEJu: SubscriptionPlan.MENTORSHIP, //this prod
      // price_1Qy0JcJ1acFkbhNI4q0axjLX: SubscriptionPlan.MENTORSHIP, // This is dev
      price_1R5wSRE0taYR7njRd270eE8O: SubscriptionPlan.CLASS, // This is prod
      // price_1R5bWkJ1acFkbhNIFMuDqkMj: SubscriptionPlan.CLASS, // This is dev
      // price_1RGOg5J1acFkbhNIBI6fd5l6: SubscriptionPlan.STOCK,
      price_1RNIS6J1acFkbhNIyPeQVOAS: SubscriptionPlan.PSICOTRADING, // This is dev
    };

    return priceToPlanMap[priceId] || null;
  }

  async cancelSubscription(
    userId: string,
    subscriptionPlan: SubscriptionPlan,
    forceNow: boolean = false,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Find the Stripe Subscription ID associated with the plan
    const subscriptionId = user.activeSubscriptions.find(() =>
      user.subscriptions.some((sub) => sub.plan === subscriptionPlan),
    );

    if (!subscriptionId) {
      throw new NotFoundException(
        'No active subscription found for this plan.',
      );
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
}
