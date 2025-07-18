import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminLog, AdminLogDocument } from './schemas/admin-log.schema';
import { UserService } from '../users/users.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(AdminLog.name) private adminLogModel: Model<AdminLogDocument>,
    private usersService: UserService,
  ) {}

  /**
   * Log admin action
   */
  async logAdminAction(data: {
    adminId: string;
    adminEmail: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    previousValue?: Record<string, any>;
    newValue?: Record<string, any>;
    ipAddress: string;
    userAgent?: string;
    status?: 'success' | 'failure';
    errorMessage?: string;
  }): Promise<AdminLog> {
    try {
      // Convert string IDs to ObjectIds
      const logData: any = {
        ...data,
        adminId: data.adminId,
        ipAddress: data.ipAddress || '0.0.0.0'
      };
      
      if (data.resourceId) {
        logData.resourceId = data.resourceId;
      }

      const log = new this.adminLogModel(logData);
      await log.save();
      this.logger.log(`Admin action logged: ${data.action} on ${data.resource} by ${data.adminEmail}`);
      return log;
    } catch (error) {
      this.logger.error('Failed to log admin action', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    try {
      const totalUsers = await this.usersService.countUsers();
      const activeUsers = await this.usersService.countActiveUsers();
      const subscribedUsers = await this.usersService.countSubscribedUsers();
      const newUsersToday = await this.usersService.countNewUsersToday();
      const newUsersThisWeek = await this.usersService.countNewUsersThisWeek();
      const newUsersThisMonth = await this.usersService.countNewUsersThisMonth();

      return {
        total: totalUsers,
        active: activeUsers,
        subscribed: subscribedUsers,
        growth: {
          today: newUsersToday,
          thisWeek: newUsersThisWeek,
          thisMonth: newUsersThisMonth,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user statistics', error);
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStatistics() {
    try {
      const subscriptionsByPlan = await this.usersService.getSubscriptionsByPlan();
      const expiringSubscriptions = await this.usersService.getExpiringSubscriptions(30);
      const recentCancellations = await this.usersService.getRecentCancellations(30);

      return {
        byPlan: subscriptionsByPlan,
        expiringSoon: expiringSubscriptions.length,
        recentCancellations: recentCancellations.length,
      };
    } catch (error) {
      this.logger.error('Failed to get subscription statistics', error);
      throw error;
    }
  }

  /**
   * Get admin logs with pagination
   */
  async getAdminLogs(options: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }) {
    const {
      page = 1,
      limit = 50,
      adminId,
      action,
      resource,
      startDate,
      endDate,
      status,
    } = options;

    const query: any = {};

    if (adminId) query.adminId = adminId;
    if (action) query.action = new RegExp(action, 'i');
    if (resource) query.resource = new RegExp(resource, 'i');
    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.adminLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.adminLogModel.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get admin activity summary
   */
  async getAdminActivitySummary(adminId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.adminLogModel.aggregate([
      {
        $match: {
          adminId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            action: '$action',
            resource: '$resource',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return logs.map(log => ({
      action: log._id.action,
      resource: log._id.resource,
      count: log.count,
    }));
  }
}