import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserService } from 'src/users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from 'src/payments/stripe/transaction.schema';
import {
  SubscriptionHistory,
  SubscriptionAction,
} from 'src/payments/stripe/subscription-history.schema';
import { EmailService } from 'src/email/email.service';
import { SubscriptionPlan } from 'src/users/user.dto';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name)
    private subscriptionHistoryModel: Model<SubscriptionHistory>,
  ) {}

  // ✅ Remove expired subscriptions every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredSubscriptions() {
    const now = new Date();
    this.logger.log('🔄 Running cleanup for expired subscriptions...');

    const users = await this.userService.findAll();

    for (const user of users) {
      const expiredSubscriptions = user.subscriptions.filter(
        (sub) => sub.expiresAt && sub.expiresAt <= now,
      );

      const activeSubscriptions = user.subscriptions.filter(
        (sub) => !sub.expiresAt || sub.expiresAt > now,
      );

      if (activeSubscriptions.length !== user.subscriptions.length) {
        // Record expired subscriptions in history
        for (const expiredSub of expiredSubscriptions) {
          await this.subscriptionHistoryModel.create({
            userId: user._id,
            plan: expiredSub.plan,
            action: SubscriptionAction.EXPIRED,
            price: 0,
            currency: 'usd',
            effectiveDate: now,
            metadata: { reason: 'Subscription expired' },
          });
        }

        user.subscriptions = activeSubscriptions;
        await this.userService.updateUser(user._id.toString(), {
          subscriptions: user.subscriptions,
        });

        this.logger.log(
          `⚠️ Removed ${expiredSubscriptions.length} expired subscriptions for user ${user._id}`,
        );
      }
    }
  }

  // ✅ Send renewal reminders for weekly manual subscriptions
  @Cron('0 10 * * *') // Run at 10 AM every day
  async sendWeeklyRenewalReminders() {
    this.logger.log('📧 Checking for weekly subscription renewal reminders...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    // Find users with weekly manual subscriptions expiring tomorrow
    const users = await this.userService.findAll();

    for (const user of users) {
      const expiringWeeklySubscriptions = user.subscriptions.filter(
        (sub) =>
          sub.plan === SubscriptionPlan.LIVE_WEEKLY_MANUAL &&
          sub.expiresAt &&
          sub.expiresAt >= tomorrow &&
          sub.expiresAt < dayAfterTomorrow,
      );

      if (expiringWeeklySubscriptions.length > 0) {
        const expirationDate = expiringWeeklySubscriptions[0].expiresAt;

        if (expirationDate) {
          const daysRemaining = Math.ceil(
            (expirationDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );

          await this.emailService.sendSubscriptionExpiringEmail(user.email, {
            firstName: user.firstName,
            planName: 'Live Semanal',
            expirationDate,
            daysRemaining: Math.max(1, daysRemaining), // Ensure at least 1 day
          });

          this.logger.log(
            `📧 Sent renewal reminder to ${user.email} for expiring weekly subscription`,
          );
        }
      }
    }
  }

  // ✅ Process failed recurring payments
  @Cron('0 */6 * * *') // Run every 6 hours
  async processFailedPayments() {
    this.logger.log('💳 Checking for failed recurring payments...');

    const failedTransactions = await this.transactionModel.find({
      status: 'failed',
      billingCycle: { $in: ['weekly', 'monthly'] },
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    });

    for (const transaction of failedTransactions) {
      const user = await this.userService.findById(
        transaction.userId.toString(),
      );

      if (user) {
        // Send payment failure notification
        const html = `
          <h2>Hello ${user.firstName},</h2>
          <p>We were unable to process your payment for your <strong>${transaction.plan}</strong> subscription.</p>
          <p>Amount: <strong>$${transaction.amount} ${transaction.currency.toUpperCase()}</strong></p>
          <p>To continue enjoying uninterrupted access to your subscription, please update your payment method.</p>
          <p><a href="${process.env.FRONTEND_URL}/academy/account" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Payment Method</a></p>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>Day Trade Dak Team</p>
        `;

        await this.emailService.sendBasicEmail(
          user.email,
          'Payment Failed - Action Required',
          html,
        );

        // Record in subscription history
        await this.subscriptionHistoryModel.create({
          userId: user._id,
          transactionId: transaction._id,
          plan: transaction.plan,
          action: SubscriptionAction.PAYMENT_FAILED,
          price: transaction.amount,
          currency: transaction.currency,
          effectiveDate: new Date(),
          metadata: {
            reason: 'Recurring payment failed',
            transactionId: transaction._id,
          },
        });

        this.logger.warn(
          `⚠️ Payment failed for user ${user.email}, plan: ${transaction.plan}`,
        );
      }
    }
  }

  // ✅ Update next billing dates for recurring subscriptions
  @Cron('0 1 * * *') // Run at 1 AM every day
  async updateNextBillingDates() {
    this.logger.log('📅 Updating next billing dates...');

    const now = new Date();
    const transactions = await this.transactionModel.find({
      billingCycle: { $in: ['weekly', 'monthly'] },
      subscriptionId: { $exists: true },
      nextBillingDate: { $lte: now },
      status: 'succeeded',
    });

    for (const transaction of transactions) {
      const newNextBillingDate = new Date(transaction.nextBillingDate);

      if (transaction.billingCycle === 'weekly') {
        newNextBillingDate.setDate(newNextBillingDate.getDate() + 7);
      } else if (transaction.billingCycle === 'monthly') {
        newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
      }

      transaction.nextBillingDate = newNextBillingDate;
      await transaction.save();

      this.logger.log(
        `📅 Updated next billing date for transaction ${transaction._id} to ${newNextBillingDate}`,
      );
    }
  }
}
