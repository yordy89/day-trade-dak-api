import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class SubscriptionSyncService {
  private readonly logger = new Logger(SubscriptionSyncService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-01-27.acacia',
    });
  }

  // Run daily at 3 AM to sync subscription dates
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncSubscriptionDates() {
    this.logger.log('🔄 Starting daily subscription sync...');
    
    try {
      // Find all users with active subscriptions
      const users = await this.userModel.find({
        'subscriptions.status': 'active',
        stripeCustomerId: { $exists: true, $ne: null }
      });

      this.logger.log(`Found ${users.length} users to sync`);
      
      let updated = 0;
      let errors = 0;

      for (const user of users) {
        try {
          const hasUpdates = await this.syncUserSubscriptions(user);
          if (hasUpdates) {
            updated++;
          }
        } catch (error) {
          errors++;
          this.logger.error(
            `Failed to sync subscriptions for user ${user._id}: ${error.message}`
          );
        }
      }

      this.logger.log(
        `✅ Subscription sync complete. Updated: ${updated}, Errors: ${errors}`
      );
    } catch (error) {
      this.logger.error('Failed to run subscription sync:', error);
    }
  }

  private async syncUserSubscriptions(user: UserDocument): Promise<boolean> {
    if (!user.stripeCustomerId) {
      return false;
    }

    // Get active subscriptions from Stripe
    const stripeSubscriptions = await this.stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    let hasUpdates = false;
    
    const updatedSubscriptions = user.subscriptions.map(sub => {
      const stripeSub = stripeSubscriptions.data.find(
        s => s.id === sub.stripeSubscriptionId
      );

      if (stripeSub) {
        const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);
        
        // Check if dates need updating
        if (!sub.currentPeriodEnd || 
            sub.currentPeriodEnd.getTime() !== newPeriodEnd.getTime()) {
          
          this.logger.log(
            `Updating subscription ${sub.stripeSubscriptionId} for user ${user._id}`
          );
          
          hasUpdates = true;
          
          return {
            ...sub,
            currentPeriodEnd: newPeriodEnd,
            expiresAt: newPeriodEnd,
            status: stripeSub.status,
          };
        }
      }
      
      return sub;
    });

    if (hasUpdates) {
      user.subscriptions = updatedSubscriptions as any;
      await user.save();
    }

    return hasUpdates;
  }

  // Manual sync for specific user
  async syncUserByEmail(email: string): Promise<void> {
    const user = await this.userModel.findOne({ email });
    
    if (!user) {
      throw new Error('User not found');
    }

    const updated = await this.syncUserSubscriptions(user);
    
    if (updated) {
      this.logger.log(`✅ Synced subscriptions for ${email}`);
    } else {
      this.logger.log(`User ${email} already up to date`);
    }
  }
}