import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
  PlanInterval,
  PlanType,
} from './subscription-plan.schema';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  // Get all active subscription plans
  async findAllPlans(type?: string): Promise<SubscriptionPlan[]> {
    const query: any = { isActive: true };
    if (type) {
      query.type = type;
    }

    return this.subscriptionPlanModel.find(query).sort({ sortOrder: 1 }).exec();
  }

  // Get a single subscription plan by ID
  async findPlanById(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanModel.findOne({ planId }).exec();
    if (!plan) {
      throw new NotFoundException(`Subscription plan ${planId} not found`);
    }
    return plan;
  }

  // Check if a user has a specific subscription
  async userHasSubscription(userId: string, planId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return false;
    }

    // Check if user has the subscription (active and not expired)
    return user.subscriptions.some((sub: any) => {
      if (typeof sub === 'string') {
        return sub === planId;
      } else if (sub && typeof sub === 'object' && 'plan' in sub) {
        if (sub.plan === planId) {
          // Check if subscription is expired
          if (!sub.expiresAt) {
            return true; // No expiration date means permanent
          }
          return new Date(sub.expiresAt) > new Date();
        }
      }
      return false;
    });
  }

  // Check if user has any of the provided subscriptions
  async userHasAnySubscription(
    userId: string,
    planIds: string[],
  ): Promise<boolean> {
    for (const planId of planIds) {
      if (await this.userHasSubscription(userId, planId)) {
        return true;
      }
    }
    return false;
  }

  // Get user's active subscriptions with details
  async getUserSubscriptions(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return [];
    }

    const activeSubscriptions = [];

    for (const sub of user.subscriptions) {
      let planId: string;
      let expiresAt: Date | null = null;

      if (typeof sub === 'string') {
        planId = sub;
      } else if (sub && typeof sub === 'object' && 'plan' in sub) {
        planId = sub.plan;
        expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;

        // Skip expired subscriptions
        if (expiresAt && expiresAt < new Date()) {
          continue;
        }
      } else {
        continue;
      }

      // Get plan details
      const plan = await this.subscriptionPlanModel.findOne({ planId }).exec();
      if (plan) {
        activeSubscriptions.push({
          planId,
          plan,
          expiresAt,
          isActive: !expiresAt || expiresAt > new Date(),
        });
      }
    }

    return activeSubscriptions;
  }

  // Get meeting permissions for a user based on their subscriptions
  async getUserMeetingPermissions(userId: string): Promise<{
    canCreateMeetings: boolean;
    maxMeetingsPerMonth: number;
    maxMeetingDuration: number;
    maxParticipantsPerMeeting: number;
    canRecordMeetings: boolean;
    canScheduleMeetings: boolean;
    hasLiveMeetingAccess: boolean;
  }> {
    const userSubscriptions = await this.getUserSubscriptions(userId);

    // Default permissions (no subscription)
    const permissions = {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false,
    };

    // Apply the best permissions from all active subscriptions
    for (const sub of userSubscriptions) {
      const planPermissions = sub.plan.meetingPermissions;
      if (planPermissions) {
        permissions.canCreateMeetings =
          permissions.canCreateMeetings || planPermissions.canCreateMeetings;
        permissions.maxMeetingsPerMonth = Math.max(
          permissions.maxMeetingsPerMonth,
          planPermissions.maxMeetingsPerMonth,
        );
        permissions.maxMeetingDuration = Math.max(
          permissions.maxMeetingDuration,
          planPermissions.maxMeetingDuration,
        );
        permissions.maxParticipantsPerMeeting = Math.max(
          permissions.maxParticipantsPerMeeting,
          planPermissions.maxParticipantsPerMeeting,
        );
        permissions.canRecordMeetings =
          permissions.canRecordMeetings || planPermissions.canRecordMeetings;
        permissions.canScheduleMeetings =
          permissions.canScheduleMeetings ||
          planPermissions.canScheduleMeetings;
        permissions.hasLiveMeetingAccess =
          permissions.hasLiveMeetingAccess ||
          planPermissions.hasLiveMeetingAccess;
      }
    }

    return permissions;
  }

  // Check if user can access a meeting based on subscriptions
  async canUserAccessMeeting(
    userId: string,
    allowedSubscriptions: string[],
  ): Promise<boolean> {
    // If no subscription restrictions, allow access
    if (!allowedSubscriptions || allowedSubscriptions.length === 0) {
      return true;
    }

    // Check if user has any of the allowed subscriptions
    return this.userHasAnySubscription(userId, allowedSubscriptions);
  }

  // Create or update a subscription plan
  async createOrUpdatePlan(
    planData: Partial<SubscriptionPlan>,
  ): Promise<SubscriptionPlan> {
    const { planId } = planData;

    if (!planId) {
      throw new Error('Plan ID is required');
    }

    const existingPlan = await this.subscriptionPlanModel
      .findOne({ planId })
      .exec();

    if (existingPlan) {
      // Update existing plan
      Object.assign(existingPlan, planData);
      return existingPlan.save();
    } else {
      // Create new plan
      const newPlan = new this.subscriptionPlanModel(planData);
      return newPlan.save();
    }
  }

  // Initialize default subscription plans (to be called on app startup)
  async initializeDefaultPlans(): Promise<void> {
    // This method is deprecated in favor of the migration script
    // Use: npm run migrate:subscription-data
    console.log(
      'Please use the migration script instead: npm run migrate:subscription-data',
    );
    return;
  }
}
