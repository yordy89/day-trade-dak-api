// src/user/user.service.ts

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserInput } from './user.dto';
import { S3ServiceOptimized } from 'src/aws/s3/s3.service.optimized';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class UserService {
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject('S3Service') private readonly s3Service: S3ServiceOptimized,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findOne(query: any): Promise<User | null> {
    return this.userModel.findOne(query).exec();
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(userId: string): Promise<User | null> {
    return this.userModel.findOne({ _id: userId }).exec();
  }

  async updateUser(
    userId: string,
    updateData: Record<string, any>,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ _id: userId }, updateData, { new: true }) // ✅ Use `_id`
      .exec();
  }

  async findByRecoveryToken(recoveryToken: string): Promise<User | null> {
    return this.userModel.findOne({ recoveryToken }).exec();
  }

  async clearRecoveryToken(userId: string): Promise<any> {
    await this.userModel
      .findOneAndUpdate({ id: userId }, { recoveryToken: null })
      .exec();
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const uploadResult = await this.s3Service.uploadProfileImage(file, userId);
    return this.userModel.findByIdAndUpdate(
      userId,
      { profileImage: uploadResult.url },
      { new: true },
    );
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    return this.userModel.findOne({ stripeCustomerId: customerId }).exec();
  }

  async saveStripeCustomerId(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { stripeCustomerId }).exec();
  }

  async deleteUserFromAdmin(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Optional: clean up related data (subscriptions, logs, etc.)
    await this.userModel.deleteOne({ _id: userId });

    return {
      message: `User ${user.email} has been successfully deleted`,
      userId,
    };
  }

  async getSubscriptionDetails(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch live subscription data from Stripe for recurring subscriptions
    const detailedSubscriptions = await Promise.all(
      user.subscriptions.map(async (sub) => {
        const subscriptionData = { ...sub };

        // If it has a Stripe subscription ID, fetch live data
        if (
          sub.stripeSubscriptionId &&
          user.activeSubscriptions.includes(sub.stripeSubscriptionId)
        ) {
          try {
            const stripeSubscription = await this.stripe.subscriptions.retrieve(
              sub.stripeSubscriptionId,
            );

            // Update with live data from Stripe
            subscriptionData.currentPeriodEnd = new Date(
              stripeSubscription.current_period_end * 1000,
            );
            subscriptionData.status = stripeSubscription.status;

            // Add next payment attempt if available
            if (stripeSubscription.status === 'active') {
              subscriptionData['nextPaymentDate'] = new Date(
                stripeSubscription.current_period_end * 1000,
              );
            }
          } catch (error) {
            console.error(
              `Failed to fetch Stripe subscription ${sub.stripeSubscriptionId}:`,
              error,
            );
          }
        }

        return subscriptionData;
      }),
    );

    return {
      subscriptions: detailedSubscriptions,
    };
  }

  // Admin statistics methods
  async countUsers(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async countActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.userModel
      .countDocuments({
        lastLogin: { $gte: thirtyDaysAgo },
      })
      .exec();
  }

  async countSubscribedUsers(): Promise<number> {
    return this.userModel
      .countDocuments({
        'subscriptions.0': { $exists: true },
        'subscriptions.status': 'active',
      })
      .exec();
  }

  async countNewUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: today },
      })
      .exec();
  }

  async countNewUsersThisWeek(): Promise<number> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: weekAgo },
      })
      .exec();
  }

  async countNewUsersThisMonth(): Promise<number> {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: monthAgo },
      })
      .exec();
  }

  async getSubscriptionsByPlan(): Promise<any> {
    const result = await this.userModel
      .aggregate([
        { $unwind: '$subscriptions' },
        { $match: { 'subscriptions.status': 'active' } },
        {
          $group: {
            _id: '$subscriptions.plan',
            count: { $sum: 1 },
            revenue: { $sum: '$subscriptions.price' },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();

    return result.map((item) => ({
      plan: item._id,
      count: item.count,
      revenue: item.revenue,
    }));
  }

  async getExpiringSubscriptions(days: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.userModel
      .find({
        'subscriptions.status': 'active',
        'subscriptions.currentPeriodEnd': {
          $gte: new Date(),
          $lte: futureDate,
        },
      })
      .select('email subscriptions')
      .exec();
  }

  async getRecentCancellations(days: number): Promise<any[]> {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    return this.userModel
      .find({
        'subscriptions.status': 'canceled',
        'subscriptions.updatedAt': { $gte: daysAgo },
      })
      .select('email subscriptions')
      .exec();
  }
}
