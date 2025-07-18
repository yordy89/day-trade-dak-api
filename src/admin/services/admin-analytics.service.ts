import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import { Transaction } from 'src/payments/stripe/transaction.schema';
import { PaymentAnalyticsService } from 'src/payments/stripe/payment-analytics.service';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    private paymentAnalyticsService: PaymentAnalyticsService,
  ) {}

  async getPaymentStats(options: {
    startDate?: Date;
    endDate?: Date;
    currency?: string;
  }) {
    const { startDate, endDate, currency = 'USD' } = options;
    
    console.log('AdminAnalyticsService.getPaymentStats - Input:', { startDate, endDate, currency });

    // Get current period metrics
    const currentMetrics = await this.paymentAnalyticsService.getPaymentMetrics(
      startDate,
      endDate,
    );

    // Calculate previous period for comparison
    const periodLength = endDate && startDate ? 
      Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;
    const previousStartDate = startDate ? 
      subDays(startDate, periodLength) : subDays(new Date(), 60);
    const previousEndDate = startDate || subDays(new Date(), 30);

    const previousMetrics = await this.paymentAnalyticsService.getPaymentMetrics(
      previousStartDate,
      previousEndDate,
    );

    // Get subscription metrics
    const subscriptionMetrics = await this.paymentAnalyticsService.getSubscriptionMetrics(
      startDate,
      endDate,
    );

    const previousSubscriptionMetrics = await this.paymentAnalyticsService.getSubscriptionMetrics(
      previousStartDate,
      previousEndDate,
    );

    // Calculate changes
    const revenueChange = previousMetrics.totalRevenue > 0 ?
      ((currentMetrics.totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue) * 100 : 0;
    
    const transactionsChange = previousMetrics.totalTransactions > 0 ?
      ((currentMetrics.totalTransactions - previousMetrics.totalTransactions) / previousMetrics.totalTransactions) * 100 : 0;
    
    const subscriptionsChange = previousSubscriptionMetrics.activeSubscriptions > 0 ?
      ((subscriptionMetrics.activeSubscriptions - previousSubscriptionMetrics.activeSubscriptions) / previousSubscriptionMetrics.activeSubscriptions) * 100 : 0;
    
    const recurringChange = previousSubscriptionMetrics.monthlyRecurringRevenue > 0 ?
      ((subscriptionMetrics.monthlyRecurringRevenue - previousSubscriptionMetrics.monthlyRecurringRevenue) / previousSubscriptionMetrics.monthlyRecurringRevenue) * 100 : 0;

    const aovChange = previousMetrics.averageTransactionValue > 0 ?
      ((currentMetrics.averageTransactionValue - previousMetrics.averageTransactionValue) / previousMetrics.averageTransactionValue) * 100 : 0;

    const churnChange = previousSubscriptionMetrics.churnRate - subscriptionMetrics.churnRate;

    const result = {
      totalRevenue: currentMetrics.totalRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      averageOrderValue: currentMetrics.averageTransactionValue,
      aovChange: Math.round(aovChange * 10) / 10,
      totalTransactions: currentMetrics.totalTransactions,
      transactionsChange: Math.round(transactionsChange * 10) / 10,
      activeSubscriptions: subscriptionMetrics.activeSubscriptions,
      subscriptionsChange: Math.round(subscriptionsChange * 10) / 10,
      recurringRevenue: subscriptionMetrics.monthlyRecurringRevenue,
      recurringChange: Math.round(recurringChange * 10) / 10,
      churnRate: subscriptionMetrics.churnRate,
      churnChange: Math.round(churnChange * 10) / 10,
    };
    
    console.log('AdminAnalyticsService.getPaymentStats - Result:', result);
    return result;
  }

  async getPaymentTransactions(options: {
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    status?: string;
    method?: string;
    plans?: string;
    minAmount?: number;
    maxAmount?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 25,
      startDate,
      endDate,
      search,
      status,
      method,
      plans,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build query
    const query: any = {};
    
    console.log('AdminAnalyticsService.getPaymentTransactions - Input filters:', {
      startDate,
      endDate,
      search,
      status,
      method,
      plans,
      minAmount,
      maxAmount
    });

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        // Set to start of day in UTC
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        // Set to end of day in UTC
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (status) {
      // Handle comma-separated values
      const statusArray = status.split(',').filter(s => s.trim());
      if (statusArray.length === 1) {
        query.status = statusArray[0];
      } else if (statusArray.length > 1) {
        query.status = { $in: statusArray };
      }
    }

    if (method) {
      // Handle comma-separated values
      const methodArray = method.split(',').filter(m => m.trim());
      if (methodArray.length === 1) {
        query.paymentMethod = methodArray[0];
      } else if (methodArray.length > 1) {
        query.paymentMethod = { $in: methodArray };
      }
    }

    if (plans) {
      // Map frontend plan values to backend values
      const planMapping: Record<string, string> = {
        'live_weekly_manual': 'LiveWeeklyManual',
        'live_weekly_recurring': 'LiveWeeklyRecurring',
        'masterclases': 'MasterClases',
        'liverecorded': 'LiveRecorded',
        'psicotrading': 'Psicotrading',
        'classes': 'Classes',
        'clases': 'Classes',
        'peace_with_money': 'PeaceWithMoney',
        'curso_opciones': 'CursoOpciones',
        'community_event': 'CommunityEvent',
        'vip_event': 'VipEvent'
      };

      // Handle comma-separated values
      const plansArray = plans.split(',').filter(p => p.trim());
      const mappedPlans = plansArray.map(plan => planMapping[plan] || plan);
      
      if (mappedPlans.length === 1) {
        query.plan = mappedPlans[0];
      } else if (mappedPlans.length > 1) {
        query.plan = { $in: mappedPlans };
      }
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      query.amount = {};
      if (minAmount !== undefined && !isNaN(minAmount)) {
        query.amount.$gte = Number(minAmount);
      }
      if (maxAmount !== undefined && !isNaN(maxAmount)) {
        query.amount.$lte = Number(maxAmount);
      }
      // Remove empty amount query if no valid values
      if (Object.keys(query.amount).length === 0) {
        delete query.amount;
      }
    }

    if (search) {
      query.$or = [
        { stripePaymentIntentId: { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } },
        { 'userId.firstName': { $regex: search, $options: 'i' } },
        { 'userId.lastName': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    console.log('AdminAnalyticsService.getPaymentTransactions - Final query:', JSON.stringify(query, null, 2));
    if (query.createdAt) {
      console.log('Date filter details:', {
        startDate: query.createdAt.$gte ? query.createdAt.$gte.toISOString() : 'none',
        endDate: query.createdAt.$lte ? query.createdAt.$lte.toISOString() : 'none'
      });
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .populate('userId', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.transactionModel.countDocuments(query),
    ]);

    // Transform transactions for frontend
    const transformedTransactions = transactions.map(transaction => {
      // Handle populated user data
      const user = transaction.userId as any;
      const customerName = user && user.firstName && user.lastName ? 
        `${user.firstName} ${user.lastName}` : 'Unknown';
      const customerEmail = user?.email || 'Unknown';
      const customerId = user?._id?.toString() || '';

      return {
        _id: transaction._id.toString(),
        transactionId: transaction.stripePaymentIntentId || transaction._id.toString(),
        customerName,
        customerEmail,
        customerId,
        amount: transaction.amount,
        currency: transaction.currency,
        method: transaction.paymentMethod || 'card',
        status: transaction.status,
        plan: transaction.plan,
        type: transaction.type,
        description: transaction.description || '',
        metadata: transaction.metadata,
        refundAmount: transaction.refundAmount,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    });

    const result = {
      transactions: transformedTransactions,
      total,
      page,
      limit,
    };
    
    console.log('AdminAnalyticsService.getPaymentTransactions - Result:', {
      transactionCount: transformedTransactions.length,
      total,
      page,
      limit
    });
    
    return result;
  }

  async getSubscriptionStats(options: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = options;
    
    console.log('AdminAnalyticsService.getSubscriptionStats - Input:', { startDate, endDate });

    // Get subscription metrics from payment analytics service
    const subscriptionMetrics = await this.paymentAnalyticsService.getSubscriptionMetrics(
      startDate,
      endDate,
    );

    // Get revenue breakdown by plan
    const revenueByPlan = await this.paymentAnalyticsService.getRevenueByPlan(
      startDate,
      endDate,
    );

    // Get previous period for comparison
    const periodLength = endDate && startDate ? 
      Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;
    const previousStartDate = startDate ? 
      subDays(startDate, periodLength) : subDays(new Date(), 60);
    const previousEndDate = startDate || subDays(new Date(), 30);

    const previousMetrics = await this.paymentAnalyticsService.getSubscriptionMetrics(
      previousStartDate,
      previousEndDate,
    );

    // Calculate growth rates
    const mrrGrowth = previousMetrics.monthlyRecurringRevenue > 0 ?
      ((subscriptionMetrics.monthlyRecurringRevenue - previousMetrics.monthlyRecurringRevenue) / previousMetrics.monthlyRecurringRevenue) * 100 : 0;
    
    const subscriberGrowth = previousMetrics.activeSubscriptions > 0 ?
      ((subscriptionMetrics.activeSubscriptions - previousMetrics.activeSubscriptions) / previousMetrics.activeSubscriptions) * 100 : 0;
    
    const ltvGrowth = previousMetrics.averageRevenuePerUser > 0 ?
      ((subscriptionMetrics.averageRevenuePerUser - previousMetrics.averageRevenuePerUser) / previousMetrics.averageRevenuePerUser) * 100 : 0;

    // Build plan breakdown
    const planBreakdown = revenueByPlan.reduce((acc, item) => {
      acc[item.plan] = {
        count: item.activeSubscriptions,
        mrr: item.revenue,
        churn: 0, // TODO: Calculate churn by plan
      };
      return acc;
    }, {} as any);

    const result = {
      totalMRR: subscriptionMetrics.monthlyRecurringRevenue,
      mrrGrowth: Math.round(mrrGrowth * 10) / 10,
      totalSubscribers: subscriptionMetrics.activeSubscriptions,
      subscriberGrowth: Math.round(subscriberGrowth * 10) / 10,
      churnRate: subscriptionMetrics.churnRate,
      churnChange: previousMetrics.churnRate - subscriptionMetrics.churnRate,
      averageLTV: subscriptionMetrics.averageRevenuePerUser * 12, // Estimate annual LTV
      ltvGrowth: Math.round(ltvGrowth * 10) / 10,
      planBreakdown,
    };
    
    console.log('AdminAnalyticsService.getSubscriptionStats - Result:', result);
    return result;
  }

  async exportReport(options: {
    type: 'revenue' | 'transactions' | 'subscriptions';
    format: 'csv' | 'pdf';
    startDate: Date;
    endDate: Date;
  }) {
    const { type, format, startDate, endDate } = options;

    // Mock implementation - replace with actual export logic
    let content = '';
    let filename = '';

    switch (type) {
      case 'revenue':
        filename = `revenue-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`;
        if (format === 'csv') {
          content = 'Date,Revenue,Transactions,AOV\n';
          // Add actual data rows
        }
        break;

      case 'transactions':
        filename = `transactions-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`;
        if (format === 'csv') {
          content = 'Transaction ID,Date,Customer,Amount,Status,Method\n';
          // Add actual data rows
        }
        break;

      case 'subscriptions':
        filename = `subscriptions-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`;
        if (format === 'csv') {
          content = 'Plan,Subscribers,MRR,Churn Rate,LTV\n';
          // Add actual data rows
        }
        break;
    }

    return {
      filename,
      content,
      contentType: format === 'csv' ? 'text/csv' : 'application/pdf',
    };
  }
}