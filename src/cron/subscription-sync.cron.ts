import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import { Transaction, PaymentStatus, TransactionType } from 'src/payments/stripe/transaction.schema';
import { SubscriptionHistory, SubscriptionAction } from 'src/payments/stripe/subscription-history.schema';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionSyncCron {
  private readonly logger = new Logger(SubscriptionSyncCron.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name) private subscriptionHistoryModel: Model<SubscriptionHistory>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-01-27.acacia',
    });
  }

  /**
   * Run every day at midnight to sync subscription dates
   */
  @Cron('0 0 * * *') // Daily at midnight
  async syncSubscriptionDates() {
    this.logger.log('🔄 Starting daily subscription sync...');
    
    try {
      await this.syncFromRecentTransactions();
      await this.syncFromStripeAPI();
      await this.checkAndFixExpiredSubscriptions();
      
      this.logger.log('✅ Daily subscription sync completed');
    } catch (error) {
      this.logger.error('❌ Error in subscription sync cron:', error);
    }
  }

  /**
   * Run every hour to catch any missed webhook updates
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlySyncCheck() {
    this.logger.log('🔍 Running hourly subscription sync check...');
    
    try {
      // Check transactions from the last 2 hours
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const recentTransactions = await this.transactionModel.find({
        type: TransactionType.SUBSCRIPTION_PAYMENT,
        status: PaymentStatus.SUCCEEDED,
        subscriptionId: { $exists: true },
        createdAt: { $gte: twoHoursAgo }
      });

      if (recentTransactions.length > 0) {
        this.logger.log(`Found ${recentTransactions.length} recent transactions to verify`);
        await this.verifyAndFixRecentTransactions(recentTransactions);
      }

    } catch (error) {
      this.logger.error('Error in hourly sync check:', error);
    }
  }

  /**
   * Sync subscription dates from recent transactions
   */
  private async syncFromRecentTransactions() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentTransactions = await this.transactionModel.find({
      type: TransactionType.SUBSCRIPTION_PAYMENT,
      status: PaymentStatus.SUCCEEDED,
      subscriptionId: { $exists: true },
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 });

    this.logger.log(`📊 Found ${recentTransactions.length} subscription payments from last 24 hours`);

    for (const transaction of recentTransactions) {
      await this.syncTransactionToUser(transaction);
    }
  }

  /**
   * Sync a single transaction to user subscription
   */
  private async syncTransactionToUser(transaction: any) {
    if (!transaction.userId || !transaction.subscriptionId) {
      return;
    }

    try {
      const user = await this.userModel.findById(transaction.userId);
      if (!user) {
        this.logger.warn(`User ${transaction.userId} not found for transaction ${transaction._id}`);
        return;
      }

      // Check if subscription exists and needs update
      const subscription = user.subscriptions.find(
        sub => sub.stripeSubscriptionId === transaction.subscriptionId
      );

      const newPeriodEnd = transaction.nextBillingDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (subscription) {
        // Check if currentPeriodEnd is outdated
        if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd < newPeriodEnd) {
          this.logger.log(`📅 Updating subscription for ${user.email}:`);
          this.logger.log(`   Old period end: ${subscription.currentPeriodEnd}`);
          this.logger.log(`   New period end: ${newPeriodEnd}`);

          // Update using positional operator
          const result = await this.userModel.updateOne(
            { 
              _id: user._id,
              'subscriptions.stripeSubscriptionId': transaction.subscriptionId
            },
            {
              $set: {
                'subscriptions.$.currentPeriodEnd': newPeriodEnd,
                'subscriptions.$.expiresAt': newPeriodEnd,
                'subscriptions.$.status': 'active',
                updatedAt: new Date()
              }
            }
          );

          if (result.modifiedCount > 0) {
            this.logger.log(`✅ Updated subscription for ${user.email}`);
          } else {
            this.logger.warn(`⚠️ No changes made for ${user.email} - attempting alternate method`);
            await this.forceUpdateSubscription(user._id.toString(), transaction.subscriptionId, newPeriodEnd, transaction.plan);
          }
        }
      } else {
        // Subscription not found, add it
        this.logger.warn(`Subscription ${transaction.subscriptionId} not found for ${user.email}, adding it`);
        
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $push: {
              subscriptions: {
                plan: transaction.plan,
                stripeSubscriptionId: transaction.subscriptionId,
                currentPeriodEnd: newPeriodEnd,
                expiresAt: newPeriodEnd,
                status: 'active',
                createdAt: transaction.createdAt
              }
            },
            $addToSet: {
              activeSubscriptions: transaction.subscriptionId
            }
          }
        );
      }

    } catch (error) {
      this.logger.error(`Error syncing transaction ${transaction._id}:`, error);
    }
  }

  /**
   * Force update subscription using direct database operations
   */
  private async forceUpdateSubscription(
    userId: string,
    subscriptionId: string,
    newPeriodEnd: Date,
    plan: string
  ) {
    try {
      // Get fresh user data
      const user = await this.userModel.findById(userId);
      if (!user) return;

      // Create updated subscriptions array
      let found = false;
      const updatedSubscriptions = user.subscriptions.map(sub => {
        if (sub.stripeSubscriptionId === subscriptionId) {
          found = true;
          return {
            plan: sub.plan || plan,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            currentPeriodEnd: newPeriodEnd,
            expiresAt: newPeriodEnd,
            status: 'active',
            createdAt: sub.createdAt || new Date()
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

      // If not found, add new subscription
      if (!found) {
        updatedSubscriptions.push({
          plan,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: newPeriodEnd,
          expiresAt: newPeriodEnd,
          status: 'active',
          createdAt: new Date()
        });
      }

      // Force update with $set
      const result = await this.userModel.updateOne(
        { _id: userId },
        { 
          $set: { 
            subscriptions: updatedSubscriptions,
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`✅ Force updated subscription for user ${userId}`);
      }

    } catch (error) {
      this.logger.error(`Error in force update for user ${userId}:`, error);
    }
  }

  /**
   * Sync subscription dates directly from Stripe API
   */
  private async syncFromStripeAPI() {
    try {
      // Get users with active Stripe subscriptions
      const users = await this.userModel.find({
        stripeCustomerId: { $exists: true, $ne: null },
        'subscriptions.stripeSubscriptionId': { $exists: true }
      }).limit(100); // Process in batches

      this.logger.log(`🔄 Syncing ${users.length} users from Stripe API`);

      for (const user of users) {
        try {
          if (!user.stripeCustomerId) continue;

          // Get active subscriptions from Stripe
          const stripeSubscriptions = await this.stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'active',
            limit: 10
          });

          for (const stripeSub of stripeSubscriptions.data) {
            const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);
            
            // Find matching subscription in user document
            const userSub = user.subscriptions.find(
              s => s.stripeSubscriptionId === stripeSub.id
            );

            if (userSub) {
              // Check if update needed
              if (!userSub.currentPeriodEnd || 
                  userSub.currentPeriodEnd.getTime() !== newPeriodEnd.getTime()) {
                
                this.logger.log(`📅 Stripe sync for ${user.email} - ${stripeSub.id}:`);
                this.logger.log(`   Current: ${userSub.currentPeriodEnd}`);
                this.logger.log(`   Stripe: ${newPeriodEnd}`);

                await this.userModel.updateOne(
                  { 
                    _id: user._id,
                    'subscriptions.stripeSubscriptionId': stripeSub.id
                  },
                  {
                    $set: {
                      'subscriptions.$.currentPeriodEnd': newPeriodEnd,
                      'subscriptions.$.expiresAt': newPeriodEnd,
                      'subscriptions.$.status': stripeSub.status,
                      updatedAt: new Date()
                    }
                  }
                );
              }
            }
          }

        } catch (error) {
          this.logger.error(`Error syncing Stripe data for ${user.email}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error in Stripe API sync:', error);
    }
  }

  /**
   * Check and fix subscriptions that should be expired
   */
  private async checkAndFixExpiredSubscriptions() {
    const now = new Date();
    
    try {
      // Find users with potentially expired subscriptions
      const users = await this.userModel.find({
        $or: [
          { 'subscriptions.expiresAt': { $lt: now } },
          { 'subscriptions.currentPeriodEnd': { $lt: now } }
        ]
      });

      this.logger.log(`🔍 Checking ${users.length} users for expired subscriptions`);

      for (const user of users) {
        let hasChanges = false;
        const updatedSubscriptions = user.subscriptions.map(sub => {
          // Check if subscription is expired
          const isExpired = (sub.expiresAt && sub.expiresAt < now) || 
                          (sub.currentPeriodEnd && sub.currentPeriodEnd < now);

          if (isExpired && sub.status === 'active') {
            hasChanges = true;
            this.logger.log(`⏰ Marking subscription as expired for ${user.email} - ${sub.plan}`);
            
            return {
              plan: sub.plan,
              stripeSubscriptionId: sub.stripeSubscriptionId,
              currentPeriodEnd: sub.currentPeriodEnd,
              expiresAt: sub.expiresAt,
              status: 'expired',
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

        if (hasChanges) {
          await this.userModel.updateOne(
            { _id: user._id },
            { 
              $set: { 
                subscriptions: updatedSubscriptions,
                updatedAt: new Date()
              }
            }
          );
        }
      }

    } catch (error) {
      this.logger.error('Error checking expired subscriptions:', error);
    }
  }

  /**
   * Verify and fix recent transactions
   */
  private async verifyAndFixRecentTransactions(transactions: any[]) {
    for (const transaction of transactions) {
      // Get the latest subscription history for this transaction
      const history = await this.subscriptionHistoryModel.findOne({
        transactionId: transaction._id
      });

      if (history && history.action === SubscriptionAction.RENEWED) {
        await this.syncTransactionToUser(transaction);
      }
    }
  }
}