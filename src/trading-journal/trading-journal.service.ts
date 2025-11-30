import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Trade, TradeDocument, TradeDirection } from './schemas/trade.schema';
import { Feedback, FeedbackDocument } from './schemas/feedback.schema';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { CloseTradeDto } from './dto/close-trade.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FilterTradesDto, TimeFilter, TradeResult } from './dto/filter-trades.dto';
import * as moment from 'moment';

@Injectable()
export class TradingJournalService {
  constructor(
    @InjectModel('JournalTrade') private tradeModel: Model<TradeDocument>,
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
  ) {}

  // Trade CRUD Operations
  async createTrade(userId: string, createTradeDto: CreateTradeDto): Promise<Trade> {
    console.log('\n========== CREATE TRADE ==========');
    console.log('📝 Received userId:', userId);
    console.log('📝 userId type:', typeof userId);
    console.log('📝 userId value:', JSON.stringify(userId));

    // Validate market against enabled markets
    await this.validateMarketType(createTradeDto.market);

    const userObjectId = new Types.ObjectId(userId);
    console.log('📝 Converted to ObjectId:', userObjectId);
    console.log('📝 ObjectId toString:', userObjectId.toString());

    const trade = new this.tradeModel({
      ...createTradeDto,
      userId: userObjectId,
    });

    const savedTrade = await trade.save();
    console.log('📝 Trade saved with userId:', savedTrade.userId);
    console.log('📝 Saved userId matches input?', savedTrade.userId.toString() === userId);
    console.log('==================================\n');

    return savedTrade;
  }

  /**
   * Validate market type against enabled markets in settings
   */
  private async validateMarketType(market: string): Promise<void> {
    try {
      // Dynamically import SettingsService to avoid circular dependency
      const settingModel = this.tradeModel.db.model('Setting');
      const setting = await settingModel.findOne({ key: 'trading_journal_enabled_markets' });

      const enabledMarkets = setting?.value || ['stocks', 'forex', 'crypto', 'futures', 'options'];

      if (!enabledMarkets.includes(market)) {
        throw new BadRequestException(
          `Market type "${market}" is not enabled. Available markets: ${enabledMarkets.join(', ')}`
        );
      }
    } catch (error) {
      // If settings check fails, allow all markets as fallback
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log error but don't block trade creation
      console.error('Failed to validate market type:', error);
    }
  }

  async findAllTrades(userId: string, filters: FilterTradesDto) {
    console.log('\n==========================================');
    console.log('🔍 findAllTrades called with userId:', userId);
    console.log('🔍 userId type:', typeof userId);
    console.log('🔍 Filters:', JSON.stringify(filters, null, 2));

    // Create ObjectId
    let userObjectId;
    try {
      userObjectId = new Types.ObjectId(userId);
      console.log('🔍 Converted to ObjectId:', userObjectId);
    } catch (error) {
      console.error('❌ Failed to convert userId to ObjectId:', error);
      throw error;
    }

    const query: any = { userId: userObjectId };

    // Apply time filters
    if (filters.timeFilter && filters.timeFilter !== TimeFilter.ALL) {
      const now = moment();
      let startDate: moment.Moment;

      switch (filters.timeFilter) {
        case TimeFilter.TODAY:
          startDate = moment().startOf('day');
          break;
        case TimeFilter.YESTERDAY:
          startDate = moment().subtract(1, 'day').startOf('day');
          query.tradeDate = {
            $gte: startDate.toDate(),
            $lt: moment().startOf('day').toDate(),
          };
          break;
        case TimeFilter.WEEK:
          startDate = moment().subtract(7, 'days');
          break;
        case TimeFilter.MONTH:
          startDate = moment().subtract(30, 'days');
          break;
        case TimeFilter.QUARTER:
          startDate = moment().subtract(90, 'days');
          break;
        case TimeFilter.YEAR:
          startDate = moment().subtract(365, 'days');
          break;
      }

      if (filters.timeFilter !== TimeFilter.YESTERDAY) {
        query.tradeDate = { $gte: startDate.toDate() };
      }
    }

    // Apply custom date range
    if (filters.timeFilter === TimeFilter.CUSTOM) {
      if (filters.startDate || filters.endDate) {
        query.tradeDate = {};
        if (filters.startDate) {
          query.tradeDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.tradeDate.$lte = new Date(filters.endDate);
        }
      }
    }

    // Apply other filters
    if (filters.symbol) {
      query.symbol = filters.symbol.toUpperCase();
    }

    if (filters.market) {
      query.market = filters.market;
    }

    if (filters.direction) {
      query.direction = filters.direction;
    }

    if (filters.strategy) {
      query.strategy = filters.strategy;
    }

    if (filters.setup) {
      query.setup = filters.setup;
    }

    if (filters.result) {
      switch (filters.result) {
        case TradeResult.WINNERS:
          query.isWinner = true;
          break;
        case TradeResult.LOSERS:
          query.isWinner = false;
          break;
        case TradeResult.BREAKEVEN:
          query.netPnl = 0;
          break;
      }
    }

    if (filters.openOnly !== undefined) {
      query.isOpen = filters.openOnly;
    }

    if (filters.reviewedOnly !== undefined) {
      query.isReviewed = filters.reviewedOnly;
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.minRMultiple !== undefined || filters.maxRMultiple !== undefined) {
      query.rMultiple = {};
      if (filters.minRMultiple !== undefined) {
        query.rMultiple.$gte = filters.minRMultiple;
      }
      if (filters.maxRMultiple !== undefined) {
        query.rMultiple.$lte = filters.maxRMultiple;
      }
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = filters.sortBy || 'tradeDate';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortBy]: sortOrder };

    // Execute query
    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    console.log('🔍 Sort:', sort);
    console.log('🔍 Skip:', skip, 'Limit:', limit);

    const [trades, total] = await Promise.all([
      this.tradeModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.tradeModel.countDocuments(query),
    ]);

    console.log('🔍 Found trades:', trades.length, 'Total count:', total);
    if (trades.length > 0) {
      console.log('🔍 First trade:', trades[0]);
    }

    // Let's also check if there are ANY trades for this user regardless of filters
    const allUserTrades = await this.tradeModel.find({ userId: new Types.ObjectId(userId) }).countDocuments();
    console.log('🔍 Total trades for user (no filters):', allUserTrades);

    // Check all trades in database
    const allTradesInDB = await this.tradeModel.find({}).limit(5).lean();
    console.log('🔍 Total trades in database:', await this.tradeModel.countDocuments({}));
    if (allTradesInDB.length > 0) {
      console.log('🔍 Sample trade from DB:', {
        _id: allTradesInDB[0]._id,
        userId: allTradesInDB[0].userId,
        userIdType: typeof allTradesInDB[0].userId,
        symbol: allTradesInDB[0].symbol,
      });
      console.log('🔍 Comparing userIds:');
      console.log('   Query userId:', userObjectId.toString());
      console.log('   DB userId:', allTradesInDB[0].userId.toString());
      console.log('   Match?', userObjectId.toString() === allTradesInDB[0].userId.toString());
    }

    return {
      trades,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  async findOneTrade(userId: string, tradeId: string): Promise<Trade> {
    const trade = await this.tradeModel.findOne({
      _id: new Types.ObjectId(tradeId),
      userId: new Types.ObjectId(userId),
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    return trade;
  }

  async updateTrade(
    userId: string,
    tradeId: string,
    updateTradeDto: UpdateTradeDto,
  ): Promise<Trade> {
    const trade = await this.tradeModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(tradeId),
        userId: new Types.ObjectId(userId),
      },
      updateTradeDto,
      { new: true, runValidators: true },
    );

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    return trade;
  }

  async closeTrade(
    userId: string,
    tradeId: string,
    closeTradeDto: CloseTradeDto,
  ): Promise<Trade> {
    // Find the trade and verify it belongs to the user
    const trade = await this.tradeModel.findOne({
      _id: new Types.ObjectId(tradeId),
      userId: new Types.ObjectId(userId),
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (!trade.isOpen) {
      throw new BadRequestException('Trade is already closed');
    }

    // Update trade with exit data
    trade.exitTime = new Date(closeTradeDto.exitTime);
    trade.exitPrice = closeTradeDto.exitPrice;
    trade.exitReasonType = closeTradeDto.exitReasonType;
    trade.exitReasonNotes = closeTradeDto.exitReasonNotes;
    trade.lessonsLearnedOnExit = closeTradeDto.lessonsLearnedOnExit;
    trade.wouldRepeatTrade = closeTradeDto.wouldRepeatTrade;
    trade.exitEmotionState = closeTradeDto.exitEmotionState;

    // Options-specific exit data
    if (closeTradeDto.exitPremium !== undefined) {
      trade.exitPremium = closeTradeDto.exitPremium;
    }
    if (closeTradeDto.underlyingPriceAtExit !== undefined) {
      trade.underlyingPriceAtExit = closeTradeDto.underlyingPriceAtExit;
    }

    // Mark as not reviewed (needs mentor attention)
    trade.isReviewed = false;

    // Save (pre-save hook will calculate P&L automatically)
    const closedTrade = await trade.save();

    return closedTrade;
  }

  async deleteTrade(userId: string, tradeId: string): Promise<void> {
    const result = await this.tradeModel.deleteOne({
      _id: new Types.ObjectId(tradeId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Trade not found');
    }

    // Also delete associated feedback
    await this.feedbackModel.deleteMany({ tradeId: new Types.ObjectId(tradeId) });
  }

  // Analytics Methods
  async getTradeStatistics(userId: string, filters?: FilterTradesDto) {
    console.log('\n==========================================');
    console.log('📊 getTradeStatistics called with userId:', userId);
    console.log('📊 Filters:', JSON.stringify(filters, null, 2));

    const userObjectId = new Types.ObjectId(userId);
    console.log('📊 Converted to ObjectId:', userObjectId);

    const query: any = { userId: userObjectId };

    // Apply time filter for statistics
    if (filters?.timeFilter && filters.timeFilter !== TimeFilter.ALL) {
      const now = moment();
      let startDate: moment.Moment;

      switch (filters.timeFilter) {
        case TimeFilter.TODAY:
          startDate = moment().startOf('day');
          break;
        case TimeFilter.WEEK:
          startDate = moment().subtract(7, 'days');
          break;
        case TimeFilter.MONTH:
          startDate = moment().subtract(30, 'days');
          break;
        case TimeFilter.QUARTER:
          startDate = moment().subtract(90, 'days');
          break;
        case TimeFilter.YEAR:
          startDate = moment().subtract(365, 'days');
          break;
        default:
          startDate = moment().subtract(30, 'days');
      }

      query.tradeDate = { $gte: startDate.toDate() };
    }

    console.log('📊 Statistics query:', JSON.stringify(query, null, 2));

    const stats = await this.tradeModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          openTrades: { $sum: { $cond: [{ $eq: ['$isOpen', true] }, 1, 0] } },
          closedTrades: { $sum: { $cond: [{ $eq: ['$isOpen', false] }, 1, 0] } },
          winners: { $sum: { $cond: [{ $and: [{ $eq: ['$isOpen', false] }, { $gt: ['$netPnl', 0] }] }, 1, 0] } },
          losers: { $sum: { $cond: [{ $and: [{ $eq: ['$isOpen', false] }, { $lt: ['$netPnl', 0] }] }, 1, 0] } },
          totalPnl: { $sum: { $cond: [{ $eq: ['$isOpen', false] }, '$netPnl', 0] } },
          totalGross: { $sum: { $cond: [{ $eq: ['$isOpen', false] }, '$pnl', 0] } },
          totalCommission: { $sum: '$commission' },
          avgWin: {
            $avg: {
              $cond: [{ $and: [{ $eq: ['$isOpen', false] }, { $gt: ['$netPnl', 0] }] }, '$netPnl', null],
            },
          },
          avgLoss: {
            $avg: {
              $cond: [{ $and: [{ $eq: ['$isOpen', false] }, { $lt: ['$netPnl', 0] }] }, '$netPnl', null],
            },
          },
          largestWin: { $max: { $cond: [{ $eq: ['$isOpen', false] }, '$netPnl', null] } },
          largestLoss: { $min: { $cond: [{ $eq: ['$isOpen', false] }, '$netPnl', null] } },
          avgRMultiple: { $avg: { $cond: [{ $eq: ['$isOpen', false] }, '$rMultiple', null] } },
          avgHoldingTime: { $avg: { $cond: [{ $eq: ['$isOpen', false] }, '$holdingTime', null] } },
          totalVolume: { $sum: { $multiply: ['$positionSize', '$entryPrice'] } },
        },
      },
    ]);

    const baseStats = stats[0] || {
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0,
      winners: 0,
      losers: 0,
      totalPnl: 0,
      totalGross: 0,
      totalCommission: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      avgRMultiple: 0,
      avgHoldingTime: 0,
      totalVolume: 0,
    };

    // Calculate derived metrics (based on closed trades only)
    const winRate = baseStats.closedTrades > 0
      ? (baseStats.winners / baseStats.closedTrades) * 100
      : 0;

    const profitFactor = baseStats.avgLoss !== 0
      ? Math.abs(baseStats.avgWin / baseStats.avgLoss)
      : 0;

    const expectancy = baseStats.closedTrades > 0
      ? baseStats.totalPnl / baseStats.closedTrades
      : 0;

    // Get additional statistics by strategy
    const strategyStats = await this.tradeModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$strategy',
          trades: { $sum: 1 },
          pnl: { $sum: '$netPnl' },
          winRate: {
            $avg: { $cond: [{ $gt: ['$netPnl', 0] }, 100, 0] },
          },
        },
      },
      { $sort: { pnl: -1 } },
      { $limit: 5 },
    ]);

    // Get statistics by market
    const marketStats = await this.tradeModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$market',
          trades: { $sum: 1 },
          pnl: { $sum: '$netPnl' },
        },
      },
    ]);

    return {
      ...baseStats,
      winRate,
      profitFactor,
      expectancy,
      strategyStats,
      marketStats,
    };
  }

  async getDailyPnL(userId: string, days: number = 30) {
    const startDate = moment().subtract(days, 'days').startOf('day').toDate();

    const dailyPnl = await this.tradeModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          tradeDate: { $gte: startDate },
          isOpen: false,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$tradeDate' },
          },
          pnl: { $sum: '$netPnl' },
          trades: { $sum: 1 },
          winners: { $sum: { $cond: [{ $gt: ['$netPnl', 0] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate cumulative P/L
    let cumulative = 0;
    return dailyPnl.map(day => ({
      date: day._id,
      pnl: day.pnl,
      cumulative: (cumulative += day.pnl),
      trades: day.trades,
      winners: day.winners,
    }));
  }

  // Feedback Methods
  async createFeedback(
    mentorId: string,
    createFeedbackDto: CreateFeedbackDto,
  ): Promise<Feedback> {
    // Verify trade exists
    const trade = await this.tradeModel.findById(createFeedbackDto.tradeId);
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Check if feedback already exists
    const existingFeedback = await this.feedbackModel.findOne({
      tradeId: new Types.ObjectId(createFeedbackDto.tradeId),
      mentorId: new Types.ObjectId(mentorId),
    });

    if (existingFeedback) {
      throw new BadRequestException('Feedback already exists for this trade');
    }

    const feedback = new this.feedbackModel({
      ...createFeedbackDto,
      mentorId: new Types.ObjectId(mentorId),
      tradeId: new Types.ObjectId(createFeedbackDto.tradeId),
      studentId: new Types.ObjectId(createFeedbackDto.studentId),
    });

    // Mark trade as reviewed
    await this.tradeModel.findByIdAndUpdate(createFeedbackDto.tradeId, {
      isReviewed: true,
      reviewedBy: new Types.ObjectId(mentorId),
      reviewedAt: new Date(),
    });

    return feedback.save();
  }

  async getTradeFeedback(tradeId: string): Promise<Feedback[]> {
    return this.feedbackModel
      .find({ tradeId: new Types.ObjectId(tradeId) })
      .populate('mentorId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getStudentFeedback(studentId: string) {
    return this.feedbackModel
      .find({
        studentId: new Types.ObjectId(studentId),
        isVisible: true,
      })
      .populate('tradeId', 'symbol tradeDate setup')
      .populate('mentorId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
  }

  // Admin Methods
  async getAllStudentTrades(studentId: string, filters: FilterTradesDto) {
    return this.findAllTrades(studentId, filters);
  }

  async getStudentsWithJournals(eventId?: string) {
    // First, get user IDs based on event filter if provided
    let userIdsFilter = null;
    if (eventId) {
      // Find all users with TRADING_JOURNAL permission for this event
      const { ModuleType } = await import('../module-permissions/module-permission.schema');
      const { ModulePermissionsService } = await import('../module-permissions/module-permissions.service');
      const modulePermissionModel = this.tradeModel.db.model('ModulePermission');

      const permissions = await modulePermissionModel.find({
        eventId,
        moduleType: 'tradingJournal',
        isActive: true,
        hasAccess: true,
      });

      userIdsFilter = permissions.map(p => p.userId);

      // If no users found for this event, return empty array
      if (userIdsFilter.length === 0) {
        return [];
      }
    }

    const pipeline: any[] = [];

    // Filter by user IDs if event filter is provided
    if (userIdsFilter) {
      pipeline.push({
        $match: { userId: { $in: userIdsFilter } }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: '$userId',
          totalTrades: { $sum: 1 },
          lastTrade: { $max: '$tradeDate' },
          openTrades: {
            $sum: { $cond: [{ $eq: ['$isOpen', true] }, 1, 0] },
          },
          winners: {
            $sum: { $cond: [{ $eq: ['$isWinner', true] }, 1, 0] },
          },
          totalPnl: { $sum: '$netPnl' },
          needsReview: {
            $sum: { $cond: [{ $eq: ['$isReviewed', false] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          totalTrades: 1,
          lastTradeDate: '$lastTrade',
          openTrades: 1,
          winners: 1,
          totalPnl: 1,
          needsReview: 1,
          winRate: {
            $multiply: [
              { $divide: ['$winners', '$totalTrades'] },
              100
            ]
          },
        },
      },
      { $sort: { lastTrade: -1 } },
    );

    const students = await this.tradeModel.aggregate(pipeline);

    return students;
  }
}