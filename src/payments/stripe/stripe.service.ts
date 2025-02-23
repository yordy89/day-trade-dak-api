import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Stripe from 'stripe';
import { Transaction } from './transaction.schema';
import { Model } from 'mongoose';
import { UserService } from 'src/users/users.service';
import { SubscriptionPlan } from 'src/users/user.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  // **Create Checkout Session**
  async createCheckoutSession(userId: string, priceId: string) {
    // ✅ Retrieve price details from Stripe
    const price = await this.stripe.prices.retrieve(priceId);

    // ✅ Check if the price is recurring or one-time
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

  // **Handle Webhook Event**
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
      this.logger.error(
        '⚠️ Webhook signature verification failed.',
        err.message,
      );
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
    const subscriptionId = session.subscription as string; // ✅ Exists for recurring payments

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
      // ✅ Fetch one-time product details from Stripe
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

      // ✅ Get expiration days from Stripe metadata
      const expirationDays = parseInt(
        productDetails.metadata?.expiration_days || '7',
        10,
      );

      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
    }

    // ✅ Always save a transaction
    await this.transactionModel.create({
      userId,
      amount,
      currency,
      status: session.payment_status || 'unknown',
      plan: subscriptionPlan,
      subscriptionId: subscriptionId || undefined,
      expiresAt: expirationDate, // ✅ Only for one-time payments
    });

    // ✅ Update User Subscription
    const updateData: Record<string, any> = {
      $addToSet: { subscriptions: subscriptionPlan },
    };

    if (expirationDate) {
      updateData.subscriptionExpiresAt = expirationDate; // ✅ Store expiration date for one-time subscriptions
    } else if (subscriptionId) {
      updateData.$addToSet = { activeSubscriptions: subscriptionId }; // ✅ Track active recurring subscriptions
    }

    await this.userService.updateUser(userId, updateData);
    this.logger.log(
      `✅ User ${userId} subscribed to ${subscriptionPlan} (Expires: ${expirationDate || 'Never'})`,
    );
  }

  // ✅ **Handle Recurring Subscription Payments**
  private async handleRecurringPayment(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const amountPaid = invoice.amount_paid / 100;
    const currency = invoice.currency;
    const invoiceId = invoice.id;

    // ✅ Find user using `customerId`
    const user = await this.userService.findByStripeCustomerId(customerId);
    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    // ✅ Ensure we don't duplicate recurring invoices
    const existingTransaction = await this.transactionModel.findOne({
      stripeSessionId: invoiceId,
    });
    if (!existingTransaction) {
      await this.transactionModel.create({
        userId: user._id.toString(),
        amount: amountPaid,
        currency,
        status: 'paid',
        stripeSessionId: invoiceId,
      });
      this.logger.log(`✅ Recurring payment recorded for user ${user._id}`);
    } else {
      this.logger.warn(`⚠️ Invoice ${invoiceId} already processed`);
    }
  }

  // ✅ **Handle Subscription Cancellation**
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    // ✅ Find user using `customerId`
    const user = await this.userService.findByStripeCustomerId(customerId);
    if (!user) {
      this.logger.warn(`⚠️ No user found for customer: ${customerId}`);
      return;
    }

    // ✅ Remove Subscription
    await this.userService.updateUser(user._id as string, {
      $pull: { subscriptions: { $in: Object.values(SubscriptionPlan) } }, // Remove all subscriptions
    });

    this.logger.log(`⚠️ Subscription canceled for user ${user._id}`);
  }

  // ✅ **Map Stripe `priceId` to SubscriptionPlan Enum**
  private mapPriceIdToPlan(priceId: string): SubscriptionPlan | null {
    const priceToPlanMap: { [key: string]: SubscriptionPlan } = {
      price_1QvUMYJ1acFkbhNIBE0cU9AS: SubscriptionPlan.BASIC,
      price_1QvjYcJ1acFkbhNIe6LUwM4C: SubscriptionPlan.PRO,
      price_12131415: SubscriptionPlan.ENTERPRISE,
    };

    return priceToPlanMap[priceId] || null;
  }

  async removeExpiredSubscriptions() {
    const now = new Date();

    // ✅ Find expired transactions
    const expiredTransactions = await this.transactionModel.find({
      expiresAt: { $lte: now }, // Find transactions where expiration is past
    });

    for (const transaction of expiredTransactions) {
      const user = await this.userService.findById(transaction.userId);
      if (!user) continue;

      // ✅ Remove the expired subscription from the user
      await this.userService.updateUser(user._id.toString(), {
        $pull: { subscriptions: transaction.plan }, // Remove expired plan
        subscriptionExpiresAt: null, // ✅ Clear expiration date
      });

      this.logger.log(
        `⚠️ Subscription expired and removed for user ${user._id}`,
      );
    }
  }
}
