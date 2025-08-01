import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import { PermissionsService } from '../../permissions/permissions.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../../constants';
import Stripe from 'stripe';
import { SubscriptionPlan } from 'src/users/user.dto';

@Injectable()
export class AdminUsersService {
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private permissionsService: PermissionsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-01-27.acacia',
    });
  }

  async getAdminHosts() {
    const adminHosts = await this.userModel
      .find({
        role: { $in: ['admin', 'super_admin'] }, // Fixed: super_admin with underscore
        $or: [
          { status: 'active' },
          { status: { $exists: false } }, // Include users without status field
        ],
      })
      .select('_id email firstName lastName fullName role profileImage')
      .sort({ role: -1, fullName: 1 }) // Super-admins first, then alphabetical
      .lean();

    console.log('Admin hosts query result:', adminHosts); // Debug log
    return adminHosts;
  }

  async getUsers(options: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    subscription?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      subscription,
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { email: new RegExp(search, 'i') },
        { fullName: new RegExp(search, 'i') },
        { _id: search.match(/^[0-9a-fA-F]{24}$/) ? search : undefined },
      ].filter((condition) => condition._id !== undefined);
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }

    // Subscription filter
    if (subscription && subscription !== 'all') {
      if (subscription === 'free') {
        query.$or = [
          { 'subscriptions.0': { $exists: false } },
          { 'subscriptions.status': { $ne: 'active' } },
        ];
      } else {
        query['subscriptions.plan'] = subscription;
        query['subscriptions.status'] = 'active';
      }
    }

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -recoveryToken')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getUserById(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -recoveryToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    bio?: string;
    city?: string;
    country?: string;
    role?: string;
    status?: string;
    allowLiveMeetingAccess?: boolean;
  }) {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generate fullName if not provided
    const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();

    const user = new this.userModel({
      ...data,
      password: hashedPassword,
      fullName,
      status: data.status || 'active',
      role: data.role || 'user',
    });

    await user.save();

    // Create default permissions for admin users
    if (user.role === Role.ADMIN) {
      await this.permissionsService.createDefaultPermissions(
        user._id.toString(),
        user.role,
      );
    }

    // Return user without sensitive data
    const { password, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async updateUser(userId: string, updateData: any) {
    // Remove sensitive fields that shouldn't be updated directly
    const { password, _id, email, stripeCustomerId, ...safeUpdateData } =
      updateData;

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: safeUpdateData },
        { new: true, runValidators: true },
      )
      .select('-password -recoveryToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(userId: string, status: string) {
    const validStatuses = ['active', 'inactive', 'banned'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { status } }, { new: true })
      .select('-password -recoveryToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      status: user.status || 'active',
    };
  }

  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Clean up related data (subscriptions, logs, etc.)

    await this.userModel.deleteOne({ _id: userId });
  }

  async exportUsers(options: {
    format: 'csv' | 'json';
    search?: string;
    status?: string;
    subscription?: string;
    role?: string;
  }) {
    const { format, ...filters } = options;

    // Get all users matching filters
    const { users } = await this.getUsers({
      page: 1,
      limit: 10000, // Export all matching users
      ...filters,
    });

    if (format === 'json') {
      return users;
    }

    // Convert to CSV
    const headers = [
      'ID',
      'Email',
      'Full Name',
      'Role',
      'Status',
      'Subscription Plan',
      'Subscription Status',
      'Last Login',
      'Created At',
    ];

    const rows = users.map((user) => [
      user._id,
      user.email,
      (user as any).fullName || '',
      user.role,
      (user as any).status || 'active',
      user.subscriptions?.[0]?.plan || 'free',
      user.subscriptions?.[0]?.status || 'none',
      (user as any).lastLogin
        ? new Date((user as any).lastLogin).toISOString()
        : '',
      (user as any).createdAt
        ? new Date((user as any).createdAt).toISOString()
        : '',
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `users-export-${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent,
      contentType: 'text/csv',
    };
  }

  // Subscription management methods
  async addUserSubscription(
    userId: string,
    subscriptionData: { plan: string; expiresAt?: string },
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create new subscription
    const subscription = {
      plan: subscriptionData.plan as SubscriptionPlan,
      status: 'active',
      createdAt: new Date(),
      expiresAt: subscriptionData.expiresAt
        ? new Date(subscriptionData.expiresAt)
        : null,
    };

    // Add subscription to user
    if (!user.subscriptions) {
      user.subscriptions = [];
    }
    user.subscriptions.push(subscription as any);

    await user.save();

    return { success: true, subscription };
  }

  async updateUserSubscription(
    userId: string,
    subscriptionId: string,
    updateData: { plan?: string; expiresAt?: string },
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Since subscriptions don't have IDs, we'll use index
    const subscriptionIndex = parseInt(subscriptionId);
    
    if (isNaN(subscriptionIndex) || !user.subscriptions || !user.subscriptions[subscriptionIndex]) {
      throw new NotFoundException('Subscription not found');
    }

    // Update subscription
    if (updateData.plan) {
      user.subscriptions[subscriptionIndex].plan = updateData.plan as SubscriptionPlan;
    }
    if (updateData.expiresAt !== undefined) {
      user.subscriptions[subscriptionIndex].expiresAt = updateData.expiresAt
        ? new Date(updateData.expiresAt)
        : null;
    }

    await user.save();

    return { success: true, subscription: user.subscriptions[subscriptionIndex] };
  }

  async cancelUserSubscription(userId: string, subscriptionId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Since subscriptions don't have IDs, we'll use index
    const subscriptionIndex = parseInt(subscriptionId);
    
    if (isNaN(subscriptionIndex) || !user.subscriptions || !user.subscriptions[subscriptionIndex]) {
      throw new NotFoundException('Subscription not found');
    }

    const subscription = user.subscriptions[subscriptionIndex];

    // If there's a Stripe subscription ID, cancel it in Stripe
    if (subscription.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('Error canceling Stripe subscription:', error);
        // Continue with local cancellation even if Stripe fails
      }
    }

    // Update subscription status
    subscription.status = 'cancelled';

    await user.save();

    return { success: true, subscription };
  }

  async deleteUserSubscription(userId: string, subscriptionId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Since subscriptions don't have IDs, we'll use index
    const subscriptionIndex = parseInt(subscriptionId);
    
    if (isNaN(subscriptionIndex) || !user.subscriptions || !user.subscriptions[subscriptionIndex]) {
      throw new NotFoundException('Subscription not found');
    }

    // Remove subscription from array
    user.subscriptions.splice(subscriptionIndex, 1);

    await user.save();

    return { success: true };
  }
}
