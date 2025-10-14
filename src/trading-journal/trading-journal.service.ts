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
    const trade = new this.tradeModel({
      ...createTradeDto,
      userId: new Types.ObjectId(userId),
    });
    return trade.save();
  }

  async findAllTrades(userId: string, filters: FilterTradesDto) {
    const query: any = { userId: new Types.ObjectId(userId) };

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
    const [trades, total] = await Promise.all([
      this.tradeModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.tradeModel.countDocuments(query),
    ]);

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
    const query: any = { userId: new Types.ObjectId(userId), isOpen: false };

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

    const stats = await this.tradeModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winners: { $sum: { $cond: [{ $gt: ['$netPnl', 0] }, 1, 0] } },
          losers: { $sum: { $cond: [{ $lt: ['$netPnl', 0] }, 1, 0] } },
          totalPnl: { $sum: '$netPnl' },
          totalGross: { $sum: '$pnl' },
          totalCommission: { $sum: '$commission' },
          avgWin: {
            $avg: {
              $cond: [{ $gt: ['$netPnl', 0] }, '$netPnl', null],
            },
          },
          avgLoss: {
            $avg: {
              $cond: [{ $lt: ['$netPnl', 0] }, '$netPnl', null],
            },
          },
          largestWin: { $max: '$netPnl' },
          largestLoss: { $min: '$netPnl' },
          avgRMultiple: { $avg: '$rMultiple' },
          avgHoldingTime: { $avg: '$holdingTime' },
          totalVolume: { $sum: { $multiply: ['$positionSize', '$entryPrice'] } },
        },
      },
    ]);

    const baseStats = stats[0] || {
      totalTrades: 0,
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

    // Calculate derived metrics
    const winRate = baseStats.totalTrades > 0
      ? (baseStats.winners / baseStats.totalTrades) * 100
      : 0;

    const profitFactor = baseStats.avgLoss !== 0
      ? Math.abs(baseStats.avgWin / baseStats.avgLoss)
      : 0;

    const expectancy = baseStats.totalTrades > 0
      ? baseStats.totalPnl / baseStats.totalTrades
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

  async getStudentsWithJournals() {
    const students = await this.tradeModel.aggregate([
      {
        $group: {
          _id: '$userId',
          totalTrades: { $sum: 1 },
          lastTrade: { $max: '$tradeDate' },
          openTrades: {
            $sum: { $cond: [{ $eq: ['$isOpen', true] }, 1, 0] },
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
          lastTrade: 1,
          openTrades: 1,
        },
      },
      { $sort: { lastTrade: -1 } },
    ]);

    return students;
  }
}