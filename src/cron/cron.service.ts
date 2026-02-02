import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { ModulePermissionsService } from 'src/module-permissions/module-permissions.service';
import { EventPartialPaymentService } from 'src/event/event-partial-payment.service';
import { User } from 'src/users/user.schema';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private stripe: Stripe;

  constructor(
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly modulePermissionsService: ModulePermissionsService,
    @Inject(forwardRef(() => EventPartialPaymentService))
    private readonly eventPartialPaymentService: EventPartialPaymentService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name)
    private subscriptionHistoryModel: Model<SubscriptionHistory>,
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  /**
   * Safely cancel a Stripe subscription with comprehensive error handling.
   */
  private async safelyCancelStripeSubscription(
    subscriptionId: string,
  ): Promise<boolean> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status === 'canceled') {
        this.logger.log(
          `[Stripe] Subscription ${subscriptionId} already cancelled`,
        );
        return true;
      }

      await this.stripe.subscriptions.cancel(subscriptionId);
      this.logger.log(`[Stripe] Cancelled subscription ${subscriptionId}`);
      return true;
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        this.logger.warn(
          `[Stripe] Subscription ${subscriptionId} not found in Stripe`,
        );
        return true; // OK - doesn't exist, nothing to cancel
      }
      if (error.message?.toLowerCase().includes('already cancel')) {
        this.logger.log(
          `[Stripe] Subscription ${subscriptionId} already cancelled`,
        );
        return true;
      }
      this.logger.error(
        `[Stripe] Error cancelling ${subscriptionId}: ${error.message}`,
      );
      return false;
    }
  }

  // ✅ Remove expired subscriptions every midnight
  // OPTIMIZED: Uses cursor-based iteration to avoid loading all users into memory
  // FIXED: Now checks both expiresAt AND currentPeriodEnd with 6hr grace period
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredSubscriptions() {
    this.logger.log('Starting expired subscription cleanup...');

    // Grace period: 6 hours buffer to handle timezone edge cases
    const gracePeriodMs = 6 * 60 * 60 * 1000; // 6 hours
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - gracePeriodMs);

    let processedCount = 0;
    let removedCount = 0;
    let errorCount = 0;

    try {
      // Query checks BOTH expiresAt AND currentPeriodEnd
      // Also handles subscriptions with undefined/null status
      const cursor = this.userModel.find({
        $or: [
          {
            'subscriptions.expiresAt': { $lte: cutoffDate },
            'subscriptions.status': { $in: ['active', null] }
          },
          {
            'subscriptions.expiresAt': { $lte: cutoffDate },
            'subscriptions.status': { $exists: false }
          },
          {
            'subscriptions.currentPeriodEnd': { $lte: cutoffDate },
            'subscriptions.status': { $in: ['active', null] }
          },
          {
            'subscriptions.currentPeriodEnd': { $lte: cutoffDate },
            'subscriptions.status': { $exists: false }
          }
        ]
      }).cursor();

      for await (const user of cursor) {
        processedCount++;

        const expiredSubscriptions = user.subscriptions.filter((sub) => {
          // Check if expired based on either field
          const isExpiredByExpiresAt = sub.expiresAt && new Date(sub.expiresAt) <= cutoffDate;
          const isExpiredByPeriodEnd = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= cutoffDate;

          // Status must be active, undefined, or null (not already 'expired' or 'cancelled')
          const statusAllowsRemoval = !sub.status || sub.status === 'active';

          return (isExpiredByExpiresAt || isExpiredByPeriodEnd) && statusAllowsRemoval;
        });

        if (expiredSubscriptions.length === 0) continue;

        const activeSubscriptions = user.subscriptions.filter((sub) => {
          const isExpiredByExpiresAt = sub.expiresAt && new Date(sub.expiresAt) <= cutoffDate;
          const isExpiredByPeriodEnd = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= cutoffDate;
          const statusAllowsRemoval = !sub.status || sub.status === 'active';
          return !((isExpiredByExpiresAt || isExpiredByPeriodEnd) && statusAllowsRemoval);
        });

        const stripeIdsToRemove: string[] = [];

        for (const expiredSub of expiredSubscriptions) {
          try {
            // Cancel in Stripe if exists
            if (expiredSub.stripeSubscriptionId) {
              await this.safelyCancelStripeSubscription(expiredSub.stripeSubscriptionId);
              stripeIdsToRemove.push(expiredSub.stripeSubscriptionId);
            }

            // Record in history
            await this.subscriptionHistoryModel.create({
              userId: user._id,
              plan: expiredSub.plan,
              action: SubscriptionAction.EXPIRED,
              stripeSubscriptionId: expiredSub.stripeSubscriptionId,
              price: 0,
              currency: 'usd',
              effectiveDate: now,
              metadata: {
                reason: 'Subscription expired - automatic cleanup',
                expiresAt: expiredSub.expiresAt,
                currentPeriodEnd: expiredSub.currentPeriodEnd,
              },
            });

            removedCount++;
            this.logger.log(
              `Removed expired subscription: User=${user.email}, Plan=${expiredSub.plan}, ` +
              `ExpiresAt=${expiredSub.expiresAt}, CurrentPeriodEnd=${expiredSub.currentPeriodEnd}`
            );
          } catch (error) {
            errorCount++;
            this.logger.error(`Error processing subscription for user ${user._id}:`, error);
          }
        }

        // Update user document
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $set: { subscriptions: activeSubscriptions },
            $pull: { activeSubscriptions: { $in: stripeIdsToRemove } },
          },
        );
      }

      this.logger.log(
        `Expired subscription cleanup complete: ` +
        `Processed=${processedCount} users, Removed=${removedCount} subscriptions, Errors=${errorCount}`
      );

      return { processedCount, removedCount, errorCount };
    } catch (error) {
      this.logger.error('Critical error in removeExpiredSubscriptions:', error);
      throw error;
    }
  }

  // ✅ Send renewal reminders for weekly manual subscriptions
  // OPTIMIZED: Uses targeted query instead of loading all users
  @Cron('0 10 * * *') // Run at 10 AM every day
  async sendWeeklyRenewalReminders() {
    this.logger.log('📧 Checking for weekly subscription renewal reminders...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    // Use cursor to find only users with expiring weekly subscriptions
    const cursor = this.userModel.find({
      'subscriptions.plan': SubscriptionPlan.LIVE_WEEKLY_MANUAL,
      'subscriptions.expiresAt': { $gte: tomorrow, $lt: dayAfterTomorrow }
    }).cursor();

    let sentCount = 0;

    for await (const user of cursor) {
      try {
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
              daysRemaining: Math.max(1, daysRemaining),
            });

            sentCount++;
            this.logger.log(
              `📧 Sent renewal reminder to ${user.email} for expiring weekly subscription`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error sending reminder to ${user.email}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Sent ${sentCount} renewal reminders`);
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

  // ✅ Remove expired module permissions every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredModulePermissions() {
    this.logger.log('🔐 Running cleanup for expired module permissions...');

    try {
      const expiredCount =
        await this.modulePermissionsService.expirePermissions();

      if (expiredCount > 0) {
        this.logger.log(`✅ Expired ${expiredCount} module permissions`);
      } else {
        this.logger.log('✅ No module permissions to expire');
      }
    } catch (error) {
      this.logger.error('❌ Error expiring module permissions:', error);
    }
  }

  // ✅ Clean up abandoned event checkouts (no payment after 2 hours)
  @Cron('0 * * * *') // Run every hour
  async cleanupAbandonedEventCheckouts() {
    this.logger.log('🧹 Cleaning up abandoned event checkouts...');

    try {
      const result = await this.eventPartialPaymentService.cleanupAbandonedCheckouts();

      if (result.deletedCount > 0) {
        this.logger.log(`✅ Cleaned up ${result.deletedCount} abandoned event checkouts`);
      } else {
        this.logger.log('✅ No abandoned checkouts to clean up');
      }
    } catch (error) {
      this.logger.error('❌ Error cleaning up abandoned checkouts:', error);
    }
  }

  // ✅ Permanently delete/anonymize soft-deleted users after 30-day grace period
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Run at midnight daily
  async permanentlyDeleteExpiredUsers() {
    this.logger.log('🗑️ Processing permanent deletion of expired soft-deleted users...');

    try {
      const now = new Date();

      // Find users marked for deletion with expired grace period
      const usersToDelete = await this.userService.findUsersForPermanentDeletion(now);

      if (usersToDelete.length === 0) {
        this.logger.log('✅ No users scheduled for permanent deletion');
        return;
      }

      this.logger.log(`Found ${usersToDelete.length} users to permanently delete/anonymize`);

      let successCount = 0;
      let failureCount = 0;

      for (const user of usersToDelete) {
        try {
          await this.userService.permanentlyDeleteUser(user._id.toString());
          successCount++;
          this.logger.log(`✅ Permanently anonymized user ${user.email} (ID: ${user._id})`);
        } catch (error) {
          failureCount++;
          this.logger.error(`❌ Failed to permanently delete user ${user._id}:`, error);
        }
      }

      this.logger.log(
        `🗑️ Permanent deletion complete. Success: ${successCount}, Failures: ${failureCount}`,
      );
    } catch (error) {
      this.logger.error('❌ Error in permanent user deletion cron:', error);
    }
  }

  // ✅ Send module permission expiration reminders
  @Cron('0 9 * * *') // Run at 9 AM every day
  async sendModulePermissionExpirationReminders() {
    this.logger.log(
      '📧 Checking for module permission expiration reminders...',
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    // Get all module types
    const moduleTypes = [
      'classes',
      'masterClasses',
      'liveRecorded',
      'psicotrading',
      'peaceWithMoney',
      'liveWeekly',
      'communityEvents',
      'vipEvents',
      'masterCourse',
    ];

    for (const moduleType of moduleTypes) {
      const usersWithAccess =
        await this.modulePermissionsService.getUsersWithModuleAccess(
          moduleType as any,
        );

      for (const { user, permission } of usersWithAccess) {
        if (permission.expiresAt) {
          const expiresAt = new Date(permission.expiresAt);

          // Check if expiring within 1-3 days
          if (expiresAt <= threeDaysFromNow && expiresAt >= tomorrow) {
            const daysRemaining = Math.ceil(
              (expiresAt.getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (daysRemaining === 1 || daysRemaining === 3) {
              await this.emailService.sendBasicEmail(
                user.email,
                `Module Access Expiring Soon - ${moduleType}`,
                `
                  <h2>Hello ${user.firstName},</h2>
                  <p>Your access to <strong>${moduleType}</strong> module will expire in <strong>${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong>.</p>
                  <p>Expiration date: <strong>${expiresAt.toLocaleDateString()}</strong></p>
                  <p>To continue accessing this module, please contact your administrator or purchase a subscription.</p>
                  <p>Best regards,<br>Day Trade Dak Team</p>
                `,
              );

              this.logger.log(
                `📧 Sent module permission expiration reminder to ${user.email} for ${moduleType} (${daysRemaining} days remaining)`,
              );
            }
          }
        }
      }
    }
  }
}
