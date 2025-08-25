import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User, UserDocument } from '../../users/user.schema';
import { FinancingPlan, FinancingPlanDocument } from './financing-plan.schema';
import { InstallmentPlan, InstallmentPlanDocument, InstallmentPlanStatus, PaymentRecord } from './installment-plan.schema';
import { addDays, addWeeks, addMonths } from 'date-fns';

@Injectable()
export class LocalFinancingService {
  private readonly logger = new Logger(LocalFinancingService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(FinancingPlan.name) private financingPlanModel: Model<FinancingPlanDocument>,
    @InjectModel(InstallmentPlan.name) private installmentPlanModel: Model<InstallmentPlanDocument>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-01-27.acacia',
    });
  }

  /**
   * Check if a user is eligible for local financing
   */
  async checkEligibility(userId: string, amount: number): Promise<{
    eligible: boolean;
    reason?: string;
    availablePlans?: FinancingPlan[];
  }> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      return { eligible: false, reason: 'User not found' };
    }

    if (!user.approvedForLocalFinancing) {
      return { eligible: false, reason: 'User not approved for local financing' };
    }

    if (user.localFinancingDetails?.maxAmount && amount > user.localFinancingDetails.maxAmount) {
      return { 
        eligible: false, 
        reason: `Amount exceeds maximum financing limit of $${user.localFinancingDetails.maxAmount}` 
      };
    }

    // Get available plans for this amount
    const availablePlans = await this.financingPlanModel.find({
      isActive: true,
      minAmount: { $lte: amount },
      maxAmount: { $gte: amount },
    }).sort({ sortOrder: 1 });

    if (availablePlans.length === 0) {
      return { 
        eligible: false, 
        reason: 'No financing plans available for this amount' 
      };
    }

    // Check if user has any defaulted plans
    const defaultedPlans = await this.installmentPlanModel.countDocuments({
      userId,
      status: InstallmentPlanStatus.DEFAULTED,
    });

    if (defaultedPlans > 0) {
      return { 
        eligible: false, 
        reason: 'Previous financing plan in default' 
      };
    }

    return { eligible: true, availablePlans };
  }

  /**
   * Create an installment plan with Stripe subscription
   */
  async createInstallmentPlan(params: {
    userId: string;
    planId: string;
    totalAmount: number;
    productType: string;
    productName: string;
    eventId?: string;
    eventRegistrationId?: string;
    metadata?: Record<string, any>;
  }) {
    const { userId, planId, totalAmount, productType, productName, eventId, eventRegistrationId, metadata } = params;

    // Check eligibility
    const eligibility = await this.checkEligibility(userId, totalAmount);
    if (!eligibility.eligible) {
      throw new ForbiddenException(eligibility.reason);
    }

    // Get the financing plan
    const financingPlan = await this.financingPlanModel.findOne({ planId, isActive: true });
    if (!financingPlan) {
      throw new NotFoundException('Financing plan not found');
    }

    // Get user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate payment details
    const downPayment = totalAmount * (financingPlan.downPaymentPercent / 100);
    const processingFee = totalAmount * (financingPlan.processingFeePercent / 100);
    const financedAmount = totalAmount - downPayment + processingFee;
    const installmentAmount = financedAmount / financingPlan.numberOfPayments;

    // Generate payment schedule
    const paymentSchedule = this.generatePaymentSchedule(
      financingPlan.numberOfPayments,
      financingPlan.frequency,
      installmentAmount,
      new Date(),
    );

    // Create installment plan document
    const installmentPlan = new this.installmentPlanModel({
      userId,
      eventId,
      eventRegistrationId,
      productType,
      productName,
      totalAmount,
      downPayment,
      financedAmount,
      financingPlanId: planId,
      installmentAmount,
      numberOfPayments: financingPlan.numberOfPayments,
      paymentsCompleted: 0,
      totalPaid: downPayment,
      status: InstallmentPlanStatus.PENDING,
      firstPaymentDate: paymentSchedule[0].dueDate,
      lastPaymentDate: paymentSchedule[paymentSchedule.length - 1].dueDate,
      nextPaymentDate: paymentSchedule[0].dueDate,
      paymentSchedule,
      processingFee,
      metadata,
      stripeCustomerId: user.stripeCustomerId,
    });

    await installmentPlan.save();

    // Create Stripe product for this installment plan
    const product = await this.stripe.products.create({
      name: `Installment Plan - ${productName}`,
      description: `${financingPlan.name} for ${productName}`,
      metadata: {
        installmentPlanId: installmentPlan._id.toString(),
        userId: userId.toString(),
        totalAmount: totalAmount.toString(),
        numberOfPayments: financingPlan.numberOfPayments.toString(),
      },
    });

    // Create recurring price
    const intervalConfig = this.getStripeInterval(financingPlan.frequency);
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(installmentAmount * 100), // Convert to cents
      currency: 'usd',
      recurring: intervalConfig,
    });

    // Update installment plan with Stripe IDs
    installmentPlan.stripeProductId = product.id;
    installmentPlan.stripePriceId = price.id;
    await installmentPlan.save();

    // Calculate subscription end date
    const subscriptionEndDate = this.calculateEndDate(
      financingPlan.numberOfPayments,
      financingPlan.frequency,
    );

    // Create checkout session for subscription
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          installmentPlanId: installmentPlan._id.toString(),
          userId: userId.toString(),
          totalPayments: financingPlan.numberOfPayments.toString(),
          productType,
          isInstallmentPlan: 'true',
          cancelAt: subscriptionEndDate.toISOString(), // Store as metadata, handle cancellation in webhook
        },
      },
      metadata: {
        installmentPlanId: installmentPlan._id.toString(),
        userId: userId.toString(),
        downPayment: downPayment.toString(),
        totalAmount: totalAmount.toString(),
        planType: 'local_financing',
      },
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/financing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/financing/cancelled`,
    });

    return {
      installmentPlan,
      checkoutSession: session,
      paymentDetails: {
        downPayment,
        installmentAmount,
        numberOfPayments: financingPlan.numberOfPayments,
        frequency: financingPlan.frequency,
        firstPaymentDate: paymentSchedule[0].dueDate,
        totalWithFees: totalAmount + processingFee,
      },
    };
  }

  /**
   * Generate payment schedule
   */
  private generatePaymentSchedule(
    numberOfPayments: number,
    frequency: string,
    amount: number,
    startDate: Date,
  ): PaymentRecord[] {
    const schedule: PaymentRecord[] = [];
    let currentDate = new Date(startDate);

    // First payment starts after the frequency period
    currentDate = this.addPaymentInterval(currentDate, frequency);

    for (let i = 1; i <= numberOfPayments; i++) {
      schedule.push({
        paymentNumber: i,
        dueDate: new Date(currentDate),
        amount,
        status: 'pending',
      });

      if (i < numberOfPayments) {
        currentDate = this.addPaymentInterval(currentDate, frequency);
      }
    }

    return schedule;
  }

  /**
   * Add payment interval to date
   */
  private addPaymentInterval(date: Date, frequency: string): Date {
    switch (frequency) {
      case 'weekly':
        return addWeeks(date, 1);
      case 'biweekly':
        return addWeeks(date, 2);
      case 'monthly':
        return addMonths(date, 1);
      default:
        return addMonths(date, 1);
    }
  }

  /**
   * Calculate subscription end date
   */
  private calculateEndDate(numberOfPayments: number, frequency: string): Date {
    let endDate = new Date();
    
    for (let i = 0; i < numberOfPayments; i++) {
      endDate = this.addPaymentInterval(endDate, frequency);
    }
    
    // Add 5 extra days as buffer
    return addDays(endDate, 5);
  }

  /**
   * Get Stripe interval configuration
   */
  private getStripeInterval(frequency: string): Stripe.PriceCreateParams.Recurring {
    switch (frequency) {
      case 'weekly':
        return { interval: 'week', interval_count: 1 };
      case 'biweekly':
        return { interval: 'week', interval_count: 2 };
      case 'monthly':
        return { interval: 'month', interval_count: 1 };
      default:
        return { interval: 'month', interval_count: 1 };
    }
  }

  /**
   * Handle successful subscription creation (webhook)
   */
  async handleSubscriptionCreated(stripeSubscriptionId: string): Promise<void> {
    const installmentPlan = await this.installmentPlanModel.findOne({
      stripePriceId: { $exists: true },
      status: InstallmentPlanStatus.PENDING,
    });

    if (installmentPlan) {
      installmentPlan.stripeSubscriptionId = stripeSubscriptionId;
      installmentPlan.status = InstallmentPlanStatus.ACTIVE;
      await installmentPlan.save();

      this.logger.log(`Installment plan ${installmentPlan._id} activated with subscription ${stripeSubscriptionId}`);
    }
  }

  /**
   * Handle successful payment (webhook)
   */
  async handlePaymentSucceeded(
    stripeSubscriptionId: string,
    paymentIntentId: string,
    amount: number,
  ): Promise<void> {
    const installmentPlan = await this.installmentPlanModel.findOne({
      stripeSubscriptionId,
      status: InstallmentPlanStatus.ACTIVE,
    });

    if (!installmentPlan) {
      this.logger.warn(`No active installment plan found for subscription ${stripeSubscriptionId}`);
      return;
    }

    // Find the next pending payment in schedule
    const nextPayment = installmentPlan.paymentSchedule.find(p => p.status === 'pending');
    
    if (nextPayment) {
      nextPayment.status = 'paid';
      nextPayment.paidDate = new Date();
      nextPayment.stripePaymentIntentId = paymentIntentId;

      installmentPlan.paymentsCompleted += 1;
      installmentPlan.totalPaid += amount / 100; // Convert from cents

      // Update next payment date
      const nextPending = installmentPlan.paymentSchedule.find(
        p => p.status === 'pending' && p.paymentNumber > nextPayment.paymentNumber,
      );
      
      if (nextPending) {
        installmentPlan.nextPaymentDate = nextPending.dueDate;
      } else {
        // All payments completed
        installmentPlan.status = InstallmentPlanStatus.COMPLETED;
        installmentPlan.completedAt = new Date();
        installmentPlan.nextPaymentDate = undefined;

        // Cancel the subscription in Stripe
        await this.cancelStripeSubscription(stripeSubscriptionId);
      }

      await installmentPlan.save();

      this.logger.log(
        `Payment ${nextPayment.paymentNumber}/${installmentPlan.numberOfPayments} completed for plan ${installmentPlan._id}`,
      );
    }
  }

  /**
   * Handle failed payment (webhook)
   */
  async handlePaymentFailed(
    stripeSubscriptionId: string,
    failureReason: string,
  ): Promise<void> {
    const installmentPlan = await this.installmentPlanModel.findOne({
      stripeSubscriptionId,
      status: InstallmentPlanStatus.ACTIVE,
    });

    if (!installmentPlan) {
      return;
    }

    installmentPlan.failedPaymentAttempts += 1;
    installmentPlan.lastFailedPaymentDate = new Date();

    // Mark as defaulted after 3 failed attempts
    if (installmentPlan.failedPaymentAttempts >= 3) {
      installmentPlan.status = InstallmentPlanStatus.DEFAULTED;
      
      // Cancel the subscription
      await this.cancelStripeSubscription(stripeSubscriptionId);
    }

    await installmentPlan.save();

    this.logger.warn(
      `Payment failed for installment plan ${installmentPlan._id}. Attempt ${installmentPlan.failedPaymentAttempts}`,
    );
  }

  /**
   * Cancel Stripe subscription
   */
  private async cancelStripeSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
      this.logger.log(`Cancelled Stripe subscription ${subscriptionId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel subscription ${subscriptionId}:`, error);
    }
  }

  /**
   * Get user's installment plans
   */
  async getUserInstallmentPlans(userId: string): Promise<InstallmentPlan[]> {
    return this.installmentPlanModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get all available financing plans
   */
  async getAvailableFinancingPlans(amount?: number): Promise<FinancingPlan[]> {
    const query: any = { isActive: true };
    
    if (amount) {
      query.minAmount = { $lte: amount };
      query.maxAmount = { $gte: amount };
    }

    return this.financingPlanModel
      .find(query)
      .sort({ sortOrder: 1 })
      .exec();
  }
}