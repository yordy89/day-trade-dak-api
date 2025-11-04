import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../users/user.schema';
import { UserService } from '../../users/users.service';
import { SubscriptionHistory, SubscriptionAction } from '../../payments/stripe/subscription-history.schema';
import { Transaction } from '../../payments/stripe/transaction.schema';
import { ModulePermissionsService } from '../../module-permissions/module-permissions.service';

@Injectable()
export class AdminMaintenanceService {
  private readonly logger = new Logger(AdminMaintenanceService.name);

  constructor(
    private readonly userService: UserService,
    private readonly modulePermissionsService: ModulePermissionsService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(SubscriptionHistory.name)
    private readonly subscriptionHistoryModel: Model<SubscriptionHistory>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  /**
   * Manually cleanup expired subscriptions
   * This is the same logic as the cron job that runs at midnight
   */
  async cleanupExpiredSubscriptions(): Promise<{
    usersChecked: number;
    usersUpdated: number;
    subscriptionsRemoved: number;
    details: any[];
  }> {
    const now = new Date();
    this.logger.log('🔄 Starting manual cleanup of expired subscriptions...');

    // Get all users directly from the model to ensure we see all data
    const users = await this.userModel.find({}).exec();
    this.logger.log(`Found ${users.length} total users to check`);
    let totalExpiredRemoved = 0;
    let usersUpdated = 0;
    const details = [];

    for (const user of users) {
      if (!user.subscriptions || user.subscriptions.length === 0) {
        continue;
      }
      
      // Filter expired subscriptions with correct logic for recurring vs manual
      const expiredSubscriptions = user.subscriptions.filter((sub) => {
        const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
        const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
        
        // For RECURRING subscriptions (has stripeSubscriptionId):
        // ONLY check currentPeriodEnd, ignore expiresAt
        // The currentPeriodEnd is the authoritative field for Stripe subscriptions
        if (sub.stripeSubscriptionId) {
          // If currentPeriodEnd exists and is expired, mark as expired
          if (currentPeriodEnd && currentPeriodEnd <= now) {
            return true;
          }
          // If no currentPeriodEnd but has stripeSubscriptionId, don't mark as expired
          // (webhook might not have updated it yet)
          return false;
        }
        
        // For MANUAL subscriptions (no stripeSubscriptionId):
        // Check expiresAt as primary, currentPeriodEnd as fallback
        if (expiresAt && expiresAt <= now) return true;
        if (!expiresAt && currentPeriodEnd && currentPeriodEnd <= now) return true;
        
        return false;
      });

      const activeSubscriptions = user.subscriptions.filter((sub) => {
        const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
        const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
        
        // For RECURRING subscriptions (has stripeSubscriptionId):
        // ONLY check currentPeriodEnd, ignore expiresAt
        if (sub.stripeSubscriptionId) {
          // Keep if currentPeriodEnd is in the future or doesn't exist
          // (no currentPeriodEnd might mean webhook hasn't updated it yet)
          return !currentPeriodEnd || currentPeriodEnd > now;
        }
        
        // For MANUAL subscriptions (no stripeSubscriptionId):
        // Check expiresAt as primary, currentPeriodEnd as fallback
        if (expiresAt && expiresAt > now) return true;
        if (!expiresAt && currentPeriodEnd && currentPeriodEnd > now) return true;
        if (!expiresAt && !currentPeriodEnd) return true; // No expiration set
        
        return false;
      });

      if (expiredSubscriptions.length > 0) {
        // Record expired subscriptions in history
        for (const expiredSub of expiredSubscriptions) {
          // Skip subscriptions without a plan
          if (!expiredSub.plan) {
            this.logger.warn(
              `Skipping subscription without plan during cleanup for user ${user.email}`,
            );
            continue;
          }

          try {
            await this.subscriptionHistoryModel.create({
              userId: user._id.toString(),
              plan: expiredSub.plan,
              action: SubscriptionAction.EXPIRED,
              price: 0,
              currency: 'usd',
              effectiveDate: now,
              metadata: {
                reason: 'Manual cleanup - Subscription expired',
                expiresAt: expiredSub.expiresAt,
                currentPeriodEnd: expiredSub.currentPeriodEnd,
                cleanedUpAt: now,
              },
            });
          } catch (error) {
            this.logger.warn(
              `Could not create history record for user ${user._id}: ${error.message}`,
            );
          }
        }

        // Update user with only active subscriptions
        user.subscriptions = activeSubscriptions;
        await this.userService.updateUser(user._id.toString(), {
          subscriptions: user.subscriptions,
        });

        totalExpiredRemoved += expiredSubscriptions.length;
        usersUpdated++;
        
        details.push({
          userId: user._id,
          email: user.email,
          removedCount: expiredSubscriptions.length,
          removedPlans: expiredSubscriptions.map(s => s.plan),
        });

        this.logger.log(
          `⚠️ Removed ${expiredSubscriptions.length} expired subscriptions for user ${user.email}`,
        );
      }
    }

    this.logger.log(
      `✅ Cleanup completed - Checked: ${users.length}, Updated: ${usersUpdated}, Removed: ${totalExpiredRemoved}`,
    );

    return {
      usersChecked: users.length,
      usersUpdated,
      subscriptionsRemoved: totalExpiredRemoved,
      details,
    };
  }

  /**
   * Get expired subscriptions without removing them (preview)
   */
  async getExpiredSubscriptions(): Promise<{
    expiredSubscriptions: any[];
    totalCount: number;
    usersAffected: number;
  }> {
    const now = new Date();
    // Get all users directly from the model to ensure we see all data
    const users = await this.userModel.find({}).exec();
    this.logger.log(`Found ${users.length} total users to check for expired subscriptions`);
    const expiredSubscriptions = [];
    const usersWithExpired = new Set();

    for (const user of users) {
      if (!user.subscriptions || user.subscriptions.length === 0) {
        continue;
      }
      
      const userExpired = user.subscriptions.filter((sub) => {
        const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
        const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
        
        // For RECURRING subscriptions (has stripeSubscriptionId):
        // ONLY check currentPeriodEnd, ignore expiresAt
        if (sub.stripeSubscriptionId) {
          // If currentPeriodEnd exists and is expired, mark as expired
          if (currentPeriodEnd && currentPeriodEnd <= now) {
            return true;
          }
          return false;
        }
        
        // For MANUAL subscriptions (no stripeSubscriptionId):
        // Check expiresAt as primary, currentPeriodEnd as fallback
        if (expiresAt && expiresAt <= now) return true;
        if (!expiresAt && currentPeriodEnd && currentPeriodEnd <= now) return true;
        
        return false;
      });

      for (const sub of userExpired) {
        // Skip subscriptions without a plan (data corruption/migration issue)
        if (!sub.plan) {
          this.logger.warn(
            `Skipping subscription without plan for user ${user.email} (${user._id})`,
          );
          continue;
        }

        // Use the correct expiration date based on subscription type
        const expirationDate = sub.stripeSubscriptionId
          ? sub.currentPeriodEnd  // For recurring, use currentPeriodEnd
          : (sub.expiresAt || sub.currentPeriodEnd);  // For manual, use expiresAt or fallback to currentPeriodEnd
        const daysExpired = expirationDate
          ? Math.floor((now.getTime() - new Date(expirationDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        usersWithExpired.add(user._id.toString());

        expiredSubscriptions.push({
          userId: user._id,
          userEmail: user.email,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          subscription: {
            plan: sub.plan,
            expiresAt: sub.expiresAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            daysExpired,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            status: sub.status,
            createdAt: sub.createdAt,
          },
        });
      }
    }

    this.logger.log(`Found ${expiredSubscriptions.length} expired subscriptions from ${usersWithExpired.size} users`);

    return {
      expiredSubscriptions,
      totalCount: expiredSubscriptions.length,
      usersAffected: usersWithExpired.size,
    };
  }

  /**
   * Get maintenance status
   */
  async getMaintenanceStatus(): Promise<any> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get last cleanup from subscription history
    const lastCleanup = await this.subscriptionHistoryModel
      .findOne({ action: SubscriptionAction.EXPIRED })
      .sort({ createdAt: -1 })
      .limit(1);
    
    // Count current expired subscriptions
    const expiredCount = await this.getExpiredSubscriptions();
    
    // Get failed transactions in last 24 hours
    const failedTransactions = await this.transactionModel.countDocuments({
      status: 'failed',
      createdAt: { $gte: oneDayAgo },
    });

    return {
      lastCleanupRun: lastCleanup?.createdAt || null,
      pendingExpiredSubscriptions: expiredCount.totalCount,
      failedTransactionsLast24h: failedTransactions,
      currentTime: now,
      nextScheduledCleanup: this.getNextMidnight(),
    };
  }

  /**
   * Run multiple maintenance tasks
   */
  async runMaintenanceTasks(tasks?: string[]): Promise<any> {
    const results = {};
    const tasksToRun = tasks || ['expired_subscriptions', 'module_permissions'];

    if (tasksToRun.includes('expired_subscriptions')) {
      results['expired_subscriptions'] = await this.cleanupExpiredSubscriptions();
    }

    if (tasksToRun.includes('module_permissions')) {
      try {
        const expiredCount = await this.modulePermissionsService.expirePermissions();
        results['module_permissions'] = {
          success: true,
          expiredCount,
        };
      } catch (error) {
        results['module_permissions'] = {
          success: false,
          error: error.message,
        };
      }
    }

    if (tasksToRun.includes('failed_payments')) {
      // This would trigger the failed payment processing
      // For now, just return a placeholder
      results['failed_payments'] = {
        message: 'Failed payment processing would run here',
        // You can inject CronService and call processFailedPayments if needed
      };
    }

    return results;
  }

  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Cleanup a single expired subscription for a specific user
   */
  async cleanupSingleSubscription(userId: string, plan: string): Promise<{
    success: boolean;
    message: string;
    userUpdated?: any;
  }> {
    const now = new Date();
    this.logger.log(`🔄 Cleaning up single subscription: User ${userId}, Plan: ${plan}`);

    try {
      // Get the user
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!user.subscriptions || user.subscriptions.length === 0) {
        throw new Error(`User has no subscriptions`);
      }

      // Find and remove the specific subscription
      const subscriptionIndex = user.subscriptions.findIndex(
        sub => sub.plan === plan
      );

      if (subscriptionIndex === -1) {
        throw new Error(`Subscription with plan ${plan} not found for user`);
      }

      const removedSubscription = user.subscriptions[subscriptionIndex];

      // Record in history before removing
      try {
        await this.subscriptionHistoryModel.create({
          userId: user._id.toString(),
          plan: removedSubscription.plan,
          action: SubscriptionAction.EXPIRED,
          price: 0,
          currency: 'usd',
          effectiveDate: now,
          metadata: { 
            reason: 'Manual single cleanup - Subscription expired',
            expiresAt: removedSubscription.expiresAt,
            currentPeriodEnd: removedSubscription.currentPeriodEnd,
            cleanedUpAt: now,
            adminAction: true,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Could not create history record for user ${user._id}: ${error.message}`,
        );
      }

      // Remove the subscription
      user.subscriptions.splice(subscriptionIndex, 1);

      // Update the user
      await this.userService.updateUser(user._id.toString(), {
        subscriptions: user.subscriptions,
      });

      this.logger.log(
        `✅ Successfully removed ${plan} subscription for user ${user.email}`,
      );

      return {
        success: true,
        message: `Successfully removed ${plan} subscription`,
        userUpdated: {
          userId: user._id,
          email: user.email,
          removedPlan: plan,
          remainingSubscriptions: user.subscriptions.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to cleanup single subscription: ${error.message}`,
      );
      throw error;
    }
  }
}