import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Transaction,
  PaymentStatus,
  BillingCycle,
  TransactionType,
} from './transaction.schema';
import {
  SubscriptionHistory,
  SubscriptionAction,
} from './subscription-history.schema';
import { SubscriptionPlan } from 'src/users/user.dto';

export interface PaymentMetrics {
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  averageTransactionValue: number;
  conversionRate: number;
}

export interface SubscriptionMetrics {
  activeSubscriptions: number;
  newSubscriptions: number;
  cancelledSubscriptions: number;
  upgrades: number;
  downgrades: number;
  churnRate: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
}

export interface RevenueByPlan {
  plan: SubscriptionPlan;
  revenue: number;
  transactionCount: number;
  activeSubscriptions: number;
}

export interface PaymentMethodDistribution {
  method: string;
  count: number;
  revenue: number;
  percentage: number;
}

@Injectable()
export class PaymentAnalyticsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(SubscriptionHistory.name)
    private subscriptionHistoryModel: Model<SubscriptionHistory>,
  ) {}

  /**
   * Get overall payment metrics for a given time period
   */
  async getPaymentMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMetrics> {
    const transactions = await this.transactionModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .exec();

    const totalRevenue = transactions
      .filter((t) => t.status === PaymentStatus.SUCCEEDED)
      .reduce((sum, t) => sum + t.amount, 0);

    const successfulTransactions = transactions.filter(
      (t) => t.status === PaymentStatus.SUCCEEDED,
    ).length;

    const failedTransactions = transactions.filter(
      (t) => t.status === PaymentStatus.FAILED,
    ).length;

    const refundedAmount = transactions.reduce(
      (sum, t) => sum + (t.refundAmount || 0),
      0,
    );

    const averageTransactionValue =
      successfulTransactions > 0 ? totalRevenue / successfulTransactions : 0;

    const conversionRate =
      transactions.length > 0
        ? (successfulTransactions / transactions.length) * 100
        : 0;

    return {
      totalRevenue,
      totalTransactions: transactions.length,
      successfulTransactions,
      failedTransactions,
      refundedAmount,
      averageTransactionValue,
      conversionRate,
    };
  }

  /**
   * Get subscription metrics for a given time period
   */
  async getSubscriptionMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<SubscriptionMetrics> {
    const subscriptionEvents = await this.subscriptionHistoryModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .exec();

    const newSubscriptions = subscriptionEvents.filter(
      (e) => e.action === SubscriptionAction.CREATED,
    ).length;

    const cancelledSubscriptions = subscriptionEvents.filter(
      (e) => e.action === SubscriptionAction.CANCELLED,
    ).length;

    const upgrades = subscriptionEvents.filter(
      (e) => e.action === SubscriptionAction.UPGRADED,
    ).length;

    const downgrades = subscriptionEvents.filter(
      (e) => e.action === SubscriptionAction.DOWNGRADED,
    ).length;

    // Get active subscriptions (those without expiration or expiring in future)
    const activeSubscriptionTransactions = await this.transactionModel
      .find({
        billingCycle: { $ne: BillingCycle.ONE_TIME },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        status: PaymentStatus.SUCCEEDED,
      })
      .distinct('userId')
      .exec();

    const activeSubscriptions = activeSubscriptionTransactions.length;

    // Calculate MRR (Monthly Recurring Revenue)
    const recurringTransactions = await this.transactionModel
      .find({
        billingCycle: { $in: [BillingCycle.MONTHLY, BillingCycle.WEEKLY] },
        status: PaymentStatus.SUCCEEDED,
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .exec();

    const monthlyRecurringRevenue = recurringTransactions.reduce((sum, t) => {
      if (t.billingCycle === BillingCycle.WEEKLY) {
        return sum + t.amount * 4.33; // Convert weekly to monthly
      }
      return sum + t.amount;
    }, 0);

    const churnRate =
      activeSubscriptions > 0
        ? (cancelledSubscriptions / activeSubscriptions) * 100
        : 0;

    const averageRevenuePerUser =
      activeSubscriptions > 0
        ? monthlyRecurringRevenue / activeSubscriptions
        : 0;

    return {
      activeSubscriptions,
      newSubscriptions,
      cancelledSubscriptions,
      upgrades,
      downgrades,
      churnRate,
      monthlyRecurringRevenue,
      averageRevenuePerUser,
    };
  }

  /**
   * Get revenue breakdown by subscription plan
   */
  async getRevenueByPlan(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueByPlan[]> {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: '$plan',
          revenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { revenue: -1 },
      },
    ]);

    // Get active subscriptions count for each plan
    const activeSubsResult = await this.transactionModel.aggregate([
      {
        $match: {
          billingCycle: { $ne: BillingCycle.ONE_TIME },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: '$plan',
          activeSubscriptions: { $sum: 1 },
        },
      },
    ]);

    const activeSubsMap = new Map(
      activeSubsResult.map((item) => [item._id, item.activeSubscriptions]),
    );

    return result.map((item) => ({
      plan: item._id,
      revenue: item.revenue,
      transactionCount: item.transactionCount,
      activeSubscriptions: activeSubsMap.get(item._id) || 0,
    }));
  }

  /**
   * Get payment method distribution
   */
  async getPaymentMethodDistribution(
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMethodDistribution[]> {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      {
        $sort: { revenue: -1 },
      },
    ]);

    const totalCount = result.reduce((sum, item) => sum + item.count, 0);

    return result.map((item) => ({
      method: item._id,
      count: item.count,
      revenue: item.revenue,
      percentage: totalCount > 0 ? (item.count / totalCount) * 100 : 0,
    }));
  }

  /**
   * Get daily revenue trend
   */
  async getDailyRevenueTrend(startDate: Date, endDate: Date) {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return result.map((item) => ({
      date: item._id,
      revenue: item.revenue,
      transactionCount: item.transactionCount,
    }));
  }

  /**
   * Get customer lifetime value by plan
   */
  async getCustomerLifetimeValue(plan?: SubscriptionPlan) {
    const match: any = { status: PaymentStatus.SUCCEEDED };
    if (plan) {
      match.plan = plan;
    }

    const result = await this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          firstPurchase: { $min: '$createdAt' },
          lastPurchase: { $max: '$createdAt' },
        },
      },
      {
        $group: {
          _id: null,
          averageLifetimeValue: { $avg: '$totalSpent' },
          maxLifetimeValue: { $max: '$totalSpent' },
          averageTransactionsPerCustomer: { $avg: '$transactionCount' },
          totalCustomers: { $sum: 1 },
        },
      },
    ]);

    return (
      result[0] || {
        averageLifetimeValue: 0,
        maxLifetimeValue: 0,
        averageTransactionsPerCustomer: 0,
        totalCustomers: 0,
      }
    );
  }

  /**
   * Get failed payment reasons
   */
  async getFailedPaymentReasons(startDate: Date, endDate: Date) {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: PaymentStatus.FAILED,
          failureReason: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$failureReason',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return result.map((item) => ({
      reason: item._id,
      count: item.count,
      totalAmount: item.totalAmount,
    }));
  }

  /**
   * Get refund analytics
   */
  async getRefundAnalytics(startDate: Date, endDate: Date) {
    const refundedTransactions = await this.transactionModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: {
          $in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
        },
      })
      .exec();

    const totalRefunded = refundedTransactions.reduce(
      (sum, t) => sum + (t.refundAmount || 0),
      0,
    );

    const refundsByPlan = await this.transactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: {
            $in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
          },
        },
      },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          totalRefunded: { $sum: '$refundAmount' },
        },
      },
      {
        $sort: { totalRefunded: -1 },
      },
    ]);

    return {
      totalRefunded,
      refundCount: refundedTransactions.length,
      refundsByPlan,
      averageRefundAmount:
        refundedTransactions.length > 0
          ? totalRefunded / refundedTransactions.length
          : 0,
    };
  }

  /**
   * Generate comprehensive payment report
   */
  async generatePaymentReport(startDate: Date, endDate: Date) {
    const [
      paymentMetrics,
      subscriptionMetrics,
      revenueByPlan,
      paymentMethodDistribution,
      dailyRevenueTrend,
      customerLifetimeValue,
      failedPaymentReasons,
      refundAnalytics,
    ] = await Promise.all([
      this.getPaymentMetrics(startDate, endDate),
      this.getSubscriptionMetrics(startDate, endDate),
      this.getRevenueByPlan(startDate, endDate),
      this.getPaymentMethodDistribution(startDate, endDate),
      this.getDailyRevenueTrend(startDate, endDate),
      this.getCustomerLifetimeValue(),
      this.getFailedPaymentReasons(startDate, endDate),
      this.getRefundAnalytics(startDate, endDate),
    ]);

    return {
      period: {
        startDate,
        endDate,
      },
      paymentMetrics,
      subscriptionMetrics,
      revenueByPlan,
      paymentMethodDistribution,
      dailyRevenueTrend,
      customerLifetimeValue,
      failedPaymentReasons,
      refundAnalytics,
      generatedAt: new Date(),
    };
  }

  /**
   * Get event revenue analytics
   */
  async getEventAnalytics(startDate: Date, endDate: Date, eventType?: string) {
    // Build match criteria
    const matchCriteria: any = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: PaymentStatus.SUCCEEDED,
      type: TransactionType.EVENT_PAYMENT,
    };

    // Filter by event type if specified
    if (eventType) {
      matchCriteria['metadata.eventType'] = eventType;
    }

    // Get event transactions
    const eventTransactions = await this.transactionModel.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            eventType: '$metadata.eventType',
            eventId: '$metadata.eventId',
            eventName: '$metadata.eventName',
          },
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageTicketPrice: { $avg: '$amount' },
          firstTransaction: { $min: '$createdAt' },
          lastTransaction: { $max: '$createdAt' },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    // Get overall event metrics
    const overallMetrics = await this.transactionModel.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransactionValue: { $avg: '$amount' },
          uniqueEvents: { $addToSet: '$metadata.eventId' },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
    ]);

    // Get revenue by event type
    const revenueByType = await this.transactionModel.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$metadata.eventType',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      period: { startDate, endDate },
      overall: overallMetrics[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        uniqueEvents: [],
        uniqueCustomers: [],
      },
      events: eventTransactions,
      revenueByType,
      filters: { eventType },
    };
  }

  /**
   * Get specific event financial metrics
   */
  async getEventMetrics(eventId: string) {
    // Get all transactions for this event
    const transactions = await this.transactionModel
      .find({
        'metadata.eventId': eventId,
        status: PaymentStatus.SUCCEEDED,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (transactions.length === 0) {
      return {
        eventId,
        message: 'No transactions found for this event',
        metrics: null,
      };
    }

    // Calculate metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const averageTicketPrice = totalRevenue / transactions.length;

    // Get unique customers
    const uniqueCustomers = new Set(
      transactions.map((t) => t.userId || t.metadata?.email).filter(Boolean),
    );

    // Get revenue by date
    const revenueByDate = await this.transactionModel.aggregate([
      {
        $match: {
          'metadata.eventId': eventId,
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          dailyRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get customer details
    const customers = transactions.map((t) => ({
      transactionId: t._id,
      customerName:
        `${t.metadata?.firstName || ''} ${t.metadata?.lastName || ''}`.trim(),
      email: t.metadata?.email,
      amount: t.amount,
      date: t.createdAt,
      registrationType: t.metadata?.registrationType,
    }));

    return {
      eventId,
      eventName: transactions[0].metadata?.eventName || 'Unknown Event',
      eventType: transactions[0].metadata?.eventType || 'Unknown Type',
      metrics: {
        totalRevenue,
        totalTransactions: transactions.length,
        averageTicketPrice,
        uniqueCustomers: uniqueCustomers.size,
        firstSale: transactions[transactions.length - 1].createdAt,
        lastSale: transactions[0].createdAt,
      },
      revenueByDate,
      recentCustomers: customers.slice(0, 10), // Last 10 customers
      topCustomers: customers.sort((a, b) => b.amount - a.amount).slice(0, 5), // Top 5 by amount
    };
  }
}
