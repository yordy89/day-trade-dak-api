import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';
import { Transaction } from 'src/payments/stripe/transaction.schema';
import { ContactMessage } from 'src/contact/contact-message.schema';
import { PaymentAnalyticsService } from 'src/payments/stripe/payment-analytics.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import * as ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import { subDays, startOfDay, endOfDay, format, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from 'date-fns';

export interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  type: string;
  available: boolean;
}

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(ContactMessage.name) private contactMessageModel: Model<ContactMessage>,
    private paymentAnalyticsService: PaymentAnalyticsService,
    private analyticsService: AdminAnalyticsService,
  ) {}

  async generateReport(config: {
    type: string;
    format: 'csv' | 'excel' | 'pdf';
    dateRange?: { start: string; end: string };
    includeCharts?: boolean;
  }) {
    // Determine date range based on report type
    const { startDate, endDate } = this.getDateRange(config.type, config.dateRange);

    // Get report data
    const reportData = await this.getReportData(config.type, { start: startDate, end: endDate });

    // Generate file based on format
    let buffer: Buffer;
    let filename: string;

    switch (config.format) {
      case 'csv':
        buffer = await this.generateCSV(reportData, config.type);
        filename = `${config.type}-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
        break;
      case 'excel':
        buffer = await this.generateExcel(reportData, config.type, startDate, endDate);
        filename = `${config.type}-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.xlsx`;
        break;
      case 'pdf':
        // For PDF, we'll return the data for now as PDF generation requires additional libraries
        buffer = Buffer.from(JSON.stringify(reportData, null, 2));
        filename = `${config.type}-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.json`;
        break;
      default:
        throw new BadRequestException('Invalid format');
    }

    return { buffer, filename };
  }

  private getDateRange(type: string, customDateRange?: { start: string; end: string }) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarterly':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'yearly':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'custom':
        if (!customDateRange) {
          throw new BadRequestException('Date range required for custom reports');
        }
        startDate = new Date(customDateRange.start);
        endDate = new Date(customDateRange.end);
        break;
      default:
        // For specific report types, use last 30 days as default
        startDate = subDays(now, 30);
        endDate = now;
    }

    return { startDate, endDate };
  }

  async getReportData(type: string, dateRange: { start?: Date; end?: Date }) {
    const { start, end } = dateRange;

    switch (type) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'quarterly':
      case 'yearly':
        return this.getComprehensiveReport(start, end);
      
      case 'revenue-analysis':
        return this.getRevenueAnalysisReport(start, end);
      
      case 'user-growth':
        return this.getUserGrowthReport(start, end);
      
      case 'subscription-analytics':
        return this.getSubscriptionAnalyticsReport(start, end);
      
      case 'payment-performance':
        return this.getPaymentPerformanceReport(start, end);
      
      case 'customer-insights':
        return this.getCustomerInsightsReport(start, end);
      
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async getComprehensiveReport(startDate: Date, endDate: Date) {
    // Get all metrics
    const [paymentStats, subscriptionStats, userStats, transactions] = await Promise.all([
      this.analyticsService.getPaymentStats({ startDate, endDate }),
      this.analyticsService.getSubscriptionStats({ startDate, endDate }),
      this.getUserStats(startDate, endDate),
      this.getTopTransactions(startDate, endDate),
    ]);

    return {
      summary: {
        dateRange: { start: startDate, end: endDate },
        generatedAt: new Date(),
      },
      revenue: {
        total: paymentStats.totalRevenue,
        change: paymentStats.revenueChange,
        transactions: paymentStats.totalTransactions,
        averageOrderValue: paymentStats.averageOrderValue,
      },
      subscriptions: {
        activeCount: subscriptionStats.totalSubscribers,
        monthlyRecurringRevenue: subscriptionStats.totalMRR,
        churnRate: subscriptionStats.churnRate,
        planBreakdown: subscriptionStats.planBreakdown,
      },
      users: userStats,
      topTransactions: transactions,
    };
  }

  private async getRevenueAnalysisReport(startDate: Date, endDate: Date) {
    const [metrics, dailyRevenue, planRevenue, methodDistribution] = await Promise.all([
      this.paymentAnalyticsService.getPaymentMetrics(startDate, endDate),
      this.paymentAnalyticsService.getDailyRevenueTrend(startDate, endDate),
      this.paymentAnalyticsService.getRevenueByPlan(startDate, endDate),
      this.paymentAnalyticsService.getPaymentMethodDistribution(startDate, endDate),
    ]);

    return {
      metrics,
      dailyTrend: dailyRevenue,
      byPlan: planRevenue,
      byMethod: methodDistribution,
    };
  }

  private async getUserGrowthReport(startDate: Date, endDate: Date) {
    const query = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [newUsers, totalUsers, usersByPlan] = await Promise.all([
      this.userModel.countDocuments(query),
      this.userModel.countDocuments({}),
      this.userModel.aggregate([
        { $match: query },
        { $unwind: { path: '$subscriptions', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: '$subscriptions.plan',
          count: { $sum: 1 },
        }},
      ]),
    ]);

    // Get daily signup trend
    const dailySignups = await this.userModel.aggregate([
      { $match: query },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    return {
      newUsers,
      totalUsers,
      growthRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
      byPlan: usersByPlan,
      dailyTrend: dailySignups,
    };
  }

  private async getSubscriptionAnalyticsReport(startDate: Date, endDate: Date) {
    const subscriptionStats = await this.analyticsService.getSubscriptionStats({ startDate, endDate });
    
    // Get subscription lifecycle data
    const subscriptionLifecycle = await this.userModel.aggregate([
      { $unwind: '$subscriptions' },
      { $match: {
        'subscriptions.createdAt': { $gte: startDate, $lte: endDate },
      }},
      { $group: {
        _id: {
          plan: '$subscriptions.plan',
          status: '$subscriptions.status',
        },
        count: { $sum: 1 },
      }},
    ]);

    return {
      overview: subscriptionStats,
      lifecycle: subscriptionLifecycle,
      retention: {
        // Add retention metrics calculation
        monthlyChurn: subscriptionStats.churnRate,
        averageLifetime: subscriptionStats.averageLTV / (subscriptionStats.totalMRR / subscriptionStats.totalSubscribers),
      },
    };
  }

  private async getPaymentPerformanceReport(startDate: Date, endDate: Date) {
    const [failedPayments, refunds, successRate] = await Promise.all([
      this.paymentAnalyticsService.getFailedPaymentReasons(startDate, endDate),
      this.paymentAnalyticsService.getRefundAnalytics(startDate, endDate),
      this.getPaymentSuccessRate(startDate, endDate),
    ]);

    return {
      performance: {
        successRate,
        failureReasons: failedPayments,
      },
      refunds,
    };
  }

  private async getCustomerInsightsReport(startDate: Date, endDate: Date) {
    // Get customer lifetime value
    const ltv = await this.paymentAnalyticsService.getCustomerLifetimeValue();
    
    // Get top customers
    const topCustomers = await this.transactionModel.aggregate([
      { $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'succeeded',
      }},
      { $group: {
        _id: '$userId',
        totalSpent: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
      }},
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      }},
      { $unwind: '$user' },
      { $project: {
        name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
        email: '$user.email',
        totalSpent: 1,
        transactionCount: 1,
      }},
    ]);

    return {
      lifetimeValue: ltv,
      topCustomers,
      segmentation: {
        // Add customer segmentation data
      },
    };
  }

  private async getUserStats(startDate: Date, endDate: Date) {
    const [newUsers, activeUsers] = await Promise.all([
      this.userModel.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      this.userModel.countDocuments({
        lastLogin: { $gte: startDate, $lte: endDate },
      }),
    ]);

    return {
      newUsers,
      activeUsers,
    };
  }

  private async getTopTransactions(startDate: Date, endDate: Date) {
    return this.transactionModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'succeeded',
      })
      .sort({ amount: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName email')
      .lean();
  }

  private async getPaymentSuccessRate(startDate: Date, endDate: Date) {
    const [succeeded, failed] = await Promise.all([
      this.transactionModel.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'succeeded',
      }),
      this.transactionModel.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'failed',
      }),
    ]);

    const total = succeeded + failed;
    return total > 0 ? (succeeded / total) * 100 : 0;
  }

  private async generateCSV(data: any, reportType: string): Promise<Buffer> {
    let csvData = [];

    // Transform data based on report type
    if (reportType === 'revenue-analysis' && data.dailyTrend) {
      csvData = data.dailyTrend.map(item => ({
        Date: item.date,
        Revenue: item.revenue,
        Transactions: item.transactionCount,
      }));
    } else if (reportType === 'user-growth' && data.dailyTrend) {
      csvData = data.dailyTrend.map(item => ({
        Date: item._id,
        'New Users': item.count,
      }));
    } else {
      // For comprehensive reports, create a summary CSV
      csvData = [{
        'Report Type': reportType,
        'Generated At': new Date().toISOString(),
        'Total Revenue': data.revenue?.total || 0,
        'Total Transactions': data.revenue?.transactions || 0,
        'Active Subscriptions': data.subscriptions?.activeCount || 0,
        'MRR': data.subscriptions?.monthlyRecurringRevenue || 0,
        'New Users': data.users?.newUsers || 0,
      }];
    }

    const parser = new Parser();
    const csv = parser.parse(csvData);
    return Buffer.from(csv);
  }

  private async generateExcel(data: any, reportType: string, startDate: Date, endDate: Date): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Add metadata
    workbook.creator = 'DayTradeDak Admin';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 25 },
    ];

    // Add summary data
    const summaryData = [
      { metric: 'Report Type', value: reportType },
      { metric: 'Date Range', value: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}` },
      { metric: 'Generated At', value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    ];

    if (data.revenue) {
      summaryData.push(
        { metric: 'Total Revenue', value: `$${data.revenue.total?.toFixed(2) || 0}` },
        { metric: 'Total Transactions', value: data.revenue.transactions || 0 },
        { metric: 'Average Order Value', value: `$${data.revenue.averageOrderValue?.toFixed(2) || 0}` },
      );
    }

    if (data.subscriptions) {
      summaryData.push(
        { metric: 'Active Subscriptions', value: data.subscriptions.activeCount || 0 },
        { metric: 'Monthly Recurring Revenue', value: `$${data.subscriptions.monthlyRecurringRevenue?.toFixed(2) || 0}` },
        { metric: 'Churn Rate', value: `${data.subscriptions.churnRate?.toFixed(2) || 0}%` },
      );
    }

    summarySheet.addRows(summaryData);

    // Style the header row
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    // Add additional sheets based on data
    if (data.dailyTrend) {
      const trendSheet = workbook.addWorksheet('Daily Trend');
      trendSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Transactions', key: 'transactions', width: 15 },
      ];
      
      const trendData = data.dailyTrend.map(item => ({
        date: item.date || item._id,
        revenue: item.revenue || 0,
        transactions: item.transactionCount || item.count || 0,
      }));
      
      trendSheet.addRows(trendData);
      
      // Style header
      const trendHeader = trendSheet.getRow(1);
      trendHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      trendHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      trendHeader.height = 20;
    }

    if (data.topTransactions) {
      const transactionsSheet = workbook.addWorksheet('Top Transactions');
      transactionsSheet.columns = [
        { header: 'Customer', key: 'customer', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Plan', key: 'plan', width: 20 },
        { header: 'Date', key: 'date', width: 20 },
      ];
      
      const transactionData = data.topTransactions.map(t => {
        let customerName = 'Unknown';
        let email = 'Unknown';
        
        // First try to get data from populated user
        if (t.userId && typeof t.userId === 'object') {
          const name = `${t.userId.firstName || ''} ${t.userId.lastName || ''}`.trim();
          if (name) customerName = name;
          if (t.userId.email) email = t.userId.email;
        }
        // If no user data, check metadata
        else if (t.metadata) {
          if (t.metadata.firstName && t.metadata.lastName) {
            customerName = `${t.metadata.firstName} ${t.metadata.lastName}`;
          }
          if (t.metadata.email) {
            email = t.metadata.email;
          }
        }
        
        return {
          customer: customerName,
          email: email,
          amount: t.amount ? `$${t.amount.toFixed(2)}` : '$0.00',
          plan: t.plan || 'N/A',
          date: t.createdAt ? format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
        };
      });
      
      transactionsSheet.addRows(transactionData);
      
      // Style header
      const transHeader = transactionsSheet.getRow(1);
      transHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      transHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      transHeader.height = 20;
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  getReportTemplates(): ReportTemplate[] {
    return [
      {
        id: 'daily',
        title: 'Daily Summary Report',
        description: 'Complete overview of daily revenue, transactions, and key metrics',
        type: 'daily',
        available: true,
      },
      {
        id: 'weekly',
        title: 'Weekly Performance Report',
        description: 'Week-over-week comparison with trends and insights',
        type: 'weekly',
        available: true,
      },
      {
        id: 'monthly',
        title: 'Monthly Financial Report',
        description: 'Comprehensive monthly P&L, subscription metrics, and revenue analysis',
        type: 'monthly',
        available: true,
      },
      {
        id: 'quarterly',
        title: 'Quarterly Business Review',
        description: 'Executive summary with quarter performance and growth metrics',
        type: 'quarterly',
        available: true,
      },
      {
        id: 'yearly',
        title: 'Annual Summary Report',
        description: 'Year-end comprehensive report with all metrics and trends',
        type: 'yearly',
        available: true,
      },
      {
        id: 'revenue-analysis',
        title: 'Revenue Analysis Report',
        description: 'Detailed revenue breakdown by plan, payment method, and trends',
        type: 'revenue-analysis',
        available: true,
      },
      {
        id: 'user-growth',
        title: 'User Growth Report',
        description: 'User acquisition, retention, and engagement metrics',
        type: 'user-growth',
        available: true,
      },
      {
        id: 'subscription-analytics',
        title: 'Subscription Analytics',
        description: 'MRR, churn analysis, and subscription lifecycle insights',
        type: 'subscription-analytics',
        available: true,
      },
      {
        id: 'payment-performance',
        title: 'Payment Performance Report',
        description: 'Success rates, failure analysis, and payment method trends',
        type: 'payment-performance',
        available: true,
      },
      {
        id: 'customer-insights',
        title: 'Customer Insights Report',
        description: 'Customer lifetime value, segmentation, and behavior analysis',
        type: 'customer-insights',
        available: true,
      },
    ];
  }
}