import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/user.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../../subscriptions/subscription-plan.schema';

interface SubscriptionFiltersDto {
  page?: string | number;
  limit?: string | number;
  search?: string;
  planId?: string;
  status?: 'active' | 'expired' | 'cancelled';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
  ) {}

  async findAllWithFilters(filters: SubscriptionFiltersDto) {
    const {
      page = 1,
      limit = 20,
      search,
      planId,
      status,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = filters;

    // Convert string values to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    try {
      const query: any = {};

      // Search filter
      if (search) {
        query.$or = [
          { planId: { $regex: search, $options: 'i' } },
          { 'displayName.es': { $regex: search, $options: 'i' } },
          { 'displayName.en': { $regex: search, $options: 'i' } },
        ];
      }

      // Plan type filter (using status field for plan type)
      if (status) {
        query.type = status;
      }

      // Specific plan filter
      if (planId) {
        query.planId = planId;
      }

      const skip = (pageNum - 1) * limitNum;
      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Get subscription plans with user count
      const pipeline: any[] = [
        { $match: query },
        {
          $lookup: {
            from: 'users',
            let: { planId: '$planId' },
            pipeline: [
              { $match: { subscriptions: { $exists: true, $ne: [] } } },
              { $unwind: '$subscriptions' },
              {
                $match: {
                  $expr: { $eq: ['$subscriptions.plan', '$$planId'] },
                },
              },
              {
                $project: {
                  _id: 1,
                  expiresAt: '$subscriptions.expiresAt',
                },
              },
            ],
            as: 'subscribers',
          },
        },
        {
          $addFields: {
            totalSubscribers: { $size: '$subscribers' },
            activeSubscribers: {
              $size: {
                $filter: {
                  input: '$subscribers',
                  as: 'sub',
                  cond: {
                    $or: [
                      { $not: ['$$sub.expiresAt'] },
                      { $gt: ['$$sub.expiresAt', new Date()] },
                    ],
                  },
                },
              },
            },
            monthlyRevenue: {
              $multiply: [
                {
                  $size: {
                    $filter: {
                      input: '$subscribers',
                      as: 'sub',
                      cond: {
                        $or: [
                          { $not: ['$$sub.expiresAt'] },
                          { $gt: ['$$sub.expiresAt', new Date()] },
                        ],
                      },
                    },
                  },
                },
                { $ifNull: ['$pricing.baseAmount', 0] },
              ],
            },
          },
        },
        {
          $project: {
            subscribers: 0, // Remove the subscribers array to reduce payload
          },
        },
        { $sort: sort },
        { $skip: skip },
        { $limit: limitNum },
      ];

      // Get total count
      const countPipeline = [{ $match: query }, { $count: 'total' }];

      const [plans, countResult] = await Promise.all([
        this.subscriptionPlanModel.aggregate(pipeline),
        this.subscriptionPlanModel.aggregate(countPipeline),
      ]);

      const total = countResult[0]?.total || 0;

      return {
        subscriptions: plans,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error in findAllWithFilters:', error);
      throw error;
    }
  }

  async testSubscriptionData() {
    // Test to see what's in the database
    const usersWithSubs = await this.userModel
      .find({
        'subscriptions.0': { $exists: true },
      })
      .limit(5)
      .lean();

    const allUsers = await this.userModel.countDocuments({});
    const plans = await this.subscriptionPlanModel.find({}).lean();
    const activePlans = await this.subscriptionPlanModel.countDocuments({
      isActive: true,
    });

    // Check for users with any subscription field
    const usersWithAnySubscription = await this.userModel.countDocuments({
      subscriptions: { $exists: true, $ne: [] },
    });

    return {
      totalUsers: allUsers,
      usersWithSubscriptions: usersWithSubs.length,
      usersWithAnySubscription,
      totalPlans: plans.length,
      activePlans,
      sampleUsers: usersWithSubs.map((u) => ({
        email: u.email,
        subscriptions: u.subscriptions,
      })),
      availablePlans: plans.map((p) => ({
        planId: p.planId,
        displayName: p.displayName,
        isActive: p.isActive,
        pricing: p.pricing,
      })),
    };
  }

  async getSubscriptionStatistics() {
    const now = new Date();

    try {
      // Get all plans first to understand the data
      const allPlans = await this.subscriptionPlanModel.find({}).lean();
      console.log('All plans count:', allPlans.length);
      console.log('Sample plan:', allPlans[0]);

      const [
        totalPlans,
        activePlans,
        totalActiveSubscribers,
        monthlyRecurringRevenue,
      ] = await Promise.all([
        // Total plans
        this.subscriptionPlanModel.countDocuments({}),

        // Active plans
        this.subscriptionPlanModel.countDocuments({ isActive: true }),

        // Total active subscribers across all plans
        this.userModel.aggregate([
          { $match: { subscriptions: { $exists: true, $ne: [] } } },
          { $unwind: '$subscriptions' },
          {
            $match: {
              $or: [
                { 'subscriptions.expiresAt': { $gt: now } },
                { 'subscriptions.expiresAt': { $exists: false } },
                { 'subscriptions.expiresAt': null },
              ],
            },
          },
          { $count: 'total' },
        ]),

        // Monthly recurring revenue calculation
        this.subscriptionPlanModel.aggregate([
          { $match: { isActive: true } },
          {
            $lookup: {
              from: 'users',
              let: { planId: '$planId' },
              pipeline: [
                {
                  $unwind: {
                    path: '$subscriptions',
                    preserveNullAndEmptyArrays: false,
                  },
                },
                {
                  $match: {
                    $expr: { $eq: ['$subscriptions.plan', '$$planId'] },
                    $or: [
                      { 'subscriptions.expiresAt': { $gt: now } },
                      { 'subscriptions.expiresAt': { $exists: false } },
                      { 'subscriptions.expiresAt': null },
                    ],
                  },
                },
              ],
              as: 'activeUsers',
            },
          },
          {
            $project: {
              planId: 1,
              pricing: 1,
              activeUserCount: { $size: '$activeUsers' },
              monthlyRevenue: {
                $multiply: [
                  { $size: '$activeUsers' },
                  {
                    $cond: {
                      if: { $eq: ['$pricing.interval', 'monthly'] },
                      then: '$pricing.baseAmount',
                      else: {
                        $cond: {
                          if: { $eq: ['$pricing.interval', 'yearly'] },
                          then: { $divide: ['$pricing.baseAmount', 12] },
                          else: {
                            $cond: {
                              if: { $eq: ['$pricing.interval', 'weekly'] },
                              then: {
                                $multiply: ['$pricing.baseAmount', 4.33],
                              },
                              else: 0,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalMRR: { $sum: '$monthlyRevenue' },
            },
          },
        ]),
      ]);

      console.log('Statistics Debug:', {
        totalPlans,
        activePlans,
        totalActiveSubscribers,
        monthlyRecurringRevenue,
      });

      // Calculate growth rate (simplified - comparing to last month)
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

      const lastMonthSubscribers = await this.userModel.aggregate([
        { $unwind: '$subscriptions' },
        {
          $match: {
            'subscriptions.createdAt': { $lte: lastMonthDate },
            $or: [
              { 'subscriptions.expiresAt': { $gt: lastMonthDate } },
              { 'subscriptions.expiresAt': { $exists: false } },
            ],
          },
        },
        { $count: 'total' },
      ]);

      const currentTotal = totalActiveSubscribers[0]?.total || 0;
      const lastMonthTotal = lastMonthSubscribers[0]?.total || 0;
      const growthRate =
        lastMonthTotal > 0
          ? ((currentTotal - lastMonthTotal) / lastMonthTotal) * 100
          : 0;

      const result = {
        totalSubscriptions: totalPlans,
        activeSubscriptions: activePlans,
        expiredSubscriptions: totalPlans - activePlans,
        monthlyRecurringRevenue: monthlyRecurringRevenue[0]?.totalMRR || 0,
        totalActiveSubscribers: currentTotal,
        growthRate: Math.round(growthRate * 100) / 100,
      };

      console.log('Statistics Result:', result);
      return result;
    } catch (error) {
      console.error('Error in getSubscriptionStatistics:', error);
      throw error;
    }
  }

  async getSubscriptionPlans() {
    return this.subscriptionPlanModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async getUserSubscriptions(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('subscriptions.plan')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.subscriptions || [];
  }

  async updateSubscription(subscriptionId: string, updateDto: any) {
    const [userId, planId] = subscriptionId.split('-');

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscriptionIndex = user.subscriptions.findIndex(
      (sub) => sub.plan === planId,
    );

    if (subscriptionIndex === -1) {
      throw new NotFoundException('Subscription not found');
    }

    // Update subscription
    if (updateDto.expiresAt) {
      user.subscriptions[subscriptionIndex].expiresAt = updateDto.expiresAt;
    }

    await user.save();
    return user.subscriptions[subscriptionIndex];
  }

  async cancelSubscription(planId: string) {
    // For plans, "cancel" means deactivate
    const plan = await this.subscriptionPlanModel.findById(planId);

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    plan.isActive = false;
    await plan.save();

    return plan;
  }

  async reactivateSubscription(planId: string) {
    // For plans, "reactivate" means activate
    const plan = await this.subscriptionPlanModel.findById(planId);

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    plan.isActive = true;
    await plan.save();

    return plan;
  }

  async createSubscriptionPlan(planData: any) {
    try {
      // Check if plan with same planId already exists
      const existingPlan = await this.subscriptionPlanModel.findOne({
        planId: planData.planId,
      });
      if (existingPlan) {
        throw new Error('A plan with this ID already exists');
      }

      const newPlan = new this.subscriptionPlanModel(planData);
      await newPlan.save();
      return newPlan;
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  async updateSubscriptionPlan(planId: string, planData: any) {
    try {
      const plan = await this.subscriptionPlanModel.findById(planId);

      if (!plan) {
        throw new NotFoundException('Subscription plan not found');
      }

      // Don't allow changing the planId
      delete planData.planId;

      Object.assign(plan, planData);
      await plan.save();
      return plan;
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      throw error;
    }
  }

  async exportSubscriptions(
    format: 'csv' | 'excel' | 'pdf',
    filters: SubscriptionFiltersDto,
  ) {
    try {
      // Get all subscription plans with filters (no pagination for export)
      const allFilters = { ...filters, limit: 10000, page: 1 };
      const { subscriptions } = await this.findAllWithFilters(allFilters);

      let buffer: Buffer;
      let filename: string;
      let contentType: string;

      switch (format) {
        case 'csv':
          buffer = await this.generateCSV(subscriptions);
          filename = `subscription-plans-${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;
        case 'excel':
          buffer = await this.generateExcel(subscriptions);
          filename = `subscription-plans-${new Date().toISOString().split('T')[0]}.xlsx`;
          contentType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          buffer = await this.generatePDF(subscriptions);
          filename = `subscription-plans-${new Date().toISOString().split('T')[0]}.pdf`;
          contentType = 'application/pdf';
          break;
      }

      return { buffer, filename, contentType };
    } catch (error) {
      console.error('Error exporting subscriptions:', error);
      throw error;
    }
  }

  private async generateCSV(subscriptions: any[]): Promise<Buffer> {
    const header =
      'ID del Plan,Nombre (ES),Nombre (EN),Tipo,Precio,Intervalo,Suscriptores Activos,Total Suscriptores,Ingresos Mensuales,Estado\n';

    const rows = subscriptions
      .map((plan) => {
        const typeLabels: Record<string, string> = {
          live: 'En Vivo',
          course: 'Curso',
          event: 'Evento',
          bundle: 'Paquete',
        };

        const intervalLabels: Record<string, string> = {
          monthly: 'Mensual',
          weekly: 'Semanal',
          yearly: 'Anual',
          once: 'Único',
        };

        return [
          plan.planId,
          plan.displayName?.es || '',
          plan.displayName?.en || '',
          typeLabels[plan.type] || plan.type,
          plan.pricing?.baseAmount || 0,
          intervalLabels[plan.pricing?.interval] || plan.pricing?.interval,
          plan.activeSubscribers || 0,
          plan.totalSubscribers || 0,
          plan.monthlyRevenue || 0,
          plan.isActive ? 'Activo' : 'Inactivo',
        ].join(',');
      })
      .join('\n');

    return Buffer.from(header + rows, 'utf-8');
  }

  private async generateExcel(subscriptions: any[]): Promise<Buffer> {
    // For now, return CSV format as Excel requires additional dependencies
    // In production, you would use a library like exceljs
    return this.generateCSV(subscriptions);
  }

  private async generatePDF(subscriptions: any[]): Promise<Buffer> {
    // For now, return CSV format as PDF requires additional dependencies
    // In production, you would use a library like pdfkit or puppeteer
    return this.generateCSV(subscriptions);
  }
}
