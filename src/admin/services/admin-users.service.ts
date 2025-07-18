import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

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
      ].filter(condition => condition._id !== undefined);
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
    fullName?: string;
    role?: string;
    status?: string;
  }) {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = new this.userModel({
      ...data,
      password: hashedPassword,
      status: data.status || 'active',
      role: data.role || 'user',
    });

    await user.save();
    
    // Return user without sensitive data
    const { password, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async updateUser(userId: string, updateData: any) {
    // Remove sensitive fields that shouldn't be updated directly
    const { password, _id, email, stripeCustomerId, ...safeUpdateData } = updateData;

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: safeUpdateData },
        { new: true, runValidators: true }
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
      .findByIdAndUpdate(
        userId,
        { $set: { status } },
        { new: true }
      )
      .select('-password -recoveryToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      status: user.status || 'active'
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

    const rows = users.map(user => [
      user._id,
      user.email,
      (user as any).fullName || '',
      user.role,
      (user as any).status || 'active',
      user.subscriptions?.[0]?.plan || 'free',
      user.subscriptions?.[0]?.status || 'none',
      (user as any).lastLogin ? new Date((user as any).lastLogin).toISOString() : '',
      (user as any).createdAt ? new Date((user as any).createdAt).toISOString() : '',
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `users-export-${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent,
      contentType: 'text/csv',
    };
  }
}