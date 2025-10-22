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

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly modulePermissionsService: ModulePermissionsService,
    @Inject(forwardRef(() => EventPartialPaymentService))
    private readonly eventPartialPaymentService: EventPartialPaymentService,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name)
    private subscriptionHistoryModel: Model<SubscriptionHistory>,
  ) {}

  // ✅ Test cron job - runs every minute (REMOVE IN PRODUCTION)
  @Cron('0 * * * * *') // Every minute at 0 seconds
  async testCronJob() {
    this.logger.log('🧪 TEST: Cron jobs are working! Time: ' + new Date().toISOString());
  }

  // ✅ Remove expired subscriptions every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredSubscriptions() {
    const now = new Date();
    this.logger.log('🔄 Running cleanup for expired subscriptions at ' + now.toISOString());

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
