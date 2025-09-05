import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import { Transaction } from './transaction.schema';
import { SubscriptionHistory } from './subscription-history.schema';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

/**
 * Fix for subscription currentPeriodEnd update issue
 * This service provides methods to fix and sync subscription dates
 */
@Injectable()
export class SubscriptionUpdateFixer {
  private readonly logger = new Logger(SubscriptionUpdateFixer.name);
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
   * Fix a specific user's subscription dates based on Stripe data
   */
  async fixUserSubscriptionDates(userId: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        this.logger.error(`User ${userId} not found`);
        return;
      }

      this.logger.log(`🔧 Fixing subscription dates for user ${user.email}`);

      // Get all active Stripe subscriptions for this user
      if (!user.stripeCustomerId) {
        this.logger.warn(`User ${userId} has no Stripe customer ID`);
        return;
      }

      const stripeSubscriptions = await this.stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
      });

      // Create a map of updated subscriptions
      const updatedSubscriptions = user.subscriptions.map(sub => {
        // Find matching Stripe subscription
        const stripeSub = stripeSubscriptions.data.find(
          s => s.id === sub.stripeSubscriptionId
        );

        if (stripeSub) {
          const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);
          
          this.logger.log(`📅 Updating ${sub.plan}:
            Old currentPeriodEnd: ${sub.currentPeriodEnd}
            New currentPeriodEnd: ${newPeriodEnd}
            Stripe Sub ID: ${stripeSub.id}
          `);

          return {
            plan: sub.plan,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            currentPeriodEnd: newPeriodEnd,
            expiresAt: newPeriodEnd,
            status: stripeSub.status,
            createdAt: sub.createdAt || new Date(stripeSub.created * 1000),
          };
        }

        return sub;
      });

      // Use atomic update with $set to ensure the update happens
      const updateResult = await this.userModel.updateOne(
        { _id: userId },
        { 
          $set: { 
            subscriptions: updatedSubscriptions,
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        this.logger.log(`✅ Successfully updated subscriptions for user ${user.email}`);
      } else {
        this.logger.warn(`⚠️ No changes made for user ${user.email}`);
      }

    } catch (error) {
      this.logger.error(`Error fixing subscription dates for user ${userId}:`, error);
    }
  }

  /**
   * Fix all users with active recurring subscriptions
   */
  async fixAllActiveSubscriptions(): Promise<void> {
    try {
      const users = await this.userModel.find({
        'subscriptions.stripeSubscriptionId': { $exists: true },
        activeSubscriptions: { $exists: true, $ne: [] }
      });

      this.logger.log(`Found ${users.length} users with active subscriptions to fix`);

      for (const user of users) {
        await this.fixUserSubscriptionDates(user._id.toString());
      }

    } catch (error) {
      this.logger.error('Error fixing all subscriptions:', error);
    }
  }

  /**
   * Sync subscription dates based on recent transactions
   * This method looks at transactions from the last 24 hours and updates subscription dates
   */
  async syncFromRecentTransactions(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Find recent recurring payment transactions
      const recentTransactions = await this.transactionModel.find({
        type: 'subscription_payment',
        status: 'succeeded',
        subscriptionId: { $exists: true },
        createdAt: { $gte: yesterday }
      });

      this.logger.log(`Found ${recentTransactions.length} recent subscription payments`);

      for (const transaction of recentTransactions) {
        if (!transaction.userId || !transaction.subscriptionId) continue;

        const user = await this.userModel.findById(transaction.userId);
        if (!user) continue;

        // Find the matching subscription
        const subIndex = user.subscriptions.findIndex(
          sub => sub.stripeSubscriptionId === transaction.subscriptionId
        );

        if (subIndex === -1) {
          this.logger.warn(`Subscription ${transaction.subscriptionId} not found for user ${user.email}`);
          continue;
        }

        // Calculate the new period end (should be in nextBillingDate from transaction)
        const newPeriodEnd = transaction.nextBillingDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        this.logger.log(`📅 Syncing from transaction for ${user.email}:
          Transaction ID: ${transaction._id}
          Subscription ID: ${transaction.subscriptionId}
          New Period End: ${newPeriodEnd}
        `);

        // Update using positional operator for precise update
        await this.userModel.updateOne(
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
      }

      this.logger.log('✅ Sync from transactions completed');

    } catch (error) {
      this.logger.error('Error syncing from transactions:', error);
    }
  }

  /**
   * Enhanced update method that ensures subscription updates are persisted
   */
  async updateSubscriptionWithRetry(
    userId: string,
    subscriptionId: string,
    currentPeriodEnd: Date,
    plan: string
  ): Promise<boolean> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      
      try {
        // First, try to update using the positional operator
        const result = await this.userModel.updateOne(
          {
            _id: userId,
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

        if (result.modifiedCount > 0) {
          this.logger.log(`✅ Successfully updated subscription ${subscriptionId} on attempt ${attempt}`);
          return true;
        }

        // If no match found, try to add the subscription if it doesn't exist
        if (result.matchedCount === 0) {
          const addResult = await this.userModel.updateOne(
            { _id: userId },
            {
              $addToSet: {
                subscriptions: {
                  plan,
                  stripeSubscriptionId: subscriptionId,
                  currentPeriodEnd,
                  expiresAt: currentPeriodEnd,
                  status: 'active',
                  createdAt: new Date()
                }
              }
            }
          );

          if (addResult.modifiedCount > 0) {
            this.logger.log(`✅ Added new subscription ${subscriptionId} on attempt ${attempt}`);
            return true;
          }
        }

      } catch (error) {
        this.logger.error(`Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return false;
  }
}