import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TradeDocument = Trade & Document;

export enum MarketType {
  STOCKS = 'stocks',
  FOREX = 'forex',
  CRYPTO = 'crypto',
  FUTURES = 'futures',
  OPTIONS = 'options',
}

export enum TradeDirection {
  LONG = 'long',
  SHORT = 'short',
}

// For options: CALL = bullish on stock, PUT = bearish on stock
export enum OptionType {
  CALL = 'call',
  PUT = 'put',
}

// For options: direction field means
// LONG = Buy to Open (you bought the option, you OWN it)
// SHORT = Sell to Open (you wrote/sold the option, you OWE it)

export enum EmotionType {
  CONFIDENT = 'confident',
  ANXIOUS = 'anxious',
  FEARFUL = 'fearful',
  GREEDY = 'greedy',
  NEUTRAL = 'neutral',
  EXCITED = 'excited',
  FRUSTRATED = 'frustrated',
  CALM = 'calm',
}

export enum ExitReason {
  HIT_STOP_LOSS = 'hit_stop_loss',
  HIT_TAKE_PROFIT = 'hit_take_profit',
  MANUAL_EXIT = 'manual_exit',
  TIME_BASED_EXIT = 'time_based_exit',
  TRAILING_STOP = 'trailing_stop',
  TECHNICAL_SIGNAL = 'technical_signal',
  NEWS_EVENT = 'news_event',
  RISK_MANAGEMENT = 'risk_management',
  // Options-specific
  EXPIRED_WORTHLESS = 'expired_worthless',
  SOLD_FOR_PROFIT = 'sold_for_profit',
  SOLD_FOR_LOSS = 'sold_for_loss',
  EXERCISED = 'exercised',
  ASSIGNED = 'assigned',
  ROLLED_POSITION = 'rolled_position',
}

@Schema({ timestamps: true })
export class Trade {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // Basic Trade Information
  @Prop({ required: true, index: true })
  tradeDate: Date;

  @Prop({ required: true, uppercase: true, index: true })
  symbol: string;

  @Prop({ enum: MarketType, required: true })
  market: MarketType;

  // Entry Details
  @Prop({ required: true })
  entryTime: Date;

  @Prop({ required: true })
  entryPrice: number;

  @Prop({ required: true })
  positionSize: number;

  @Prop({ enum: TradeDirection, required: true })
  direction: TradeDirection;

  // Options-specific fields
  @Prop({ enum: OptionType })
  optionType?: OptionType; // CALL or PUT

  @Prop()
  strikePrice?: number;

  @Prop()
  expirationDate?: Date;

  // Exit Details
  @Prop()
  exitTime?: Date;

  @Prop()
  exitPrice?: number;

  @Prop()
  exitReason?: string;

  @Prop({ enum: ExitReason })
  exitReasonType?: ExitReason;

  @Prop()
  exitReasonNotes?: string;

  // Options-specific exit data
  @Prop()
  exitPremium?: number;

  @Prop()
  underlyingPriceAtExit?: number;

  // Self-reflection
  @Prop()
  lessonsLearnedOnExit?: string;

  @Prop()
  wouldRepeatTrade?: boolean;

  @Prop({ enum: EmotionType })
  exitEmotionState?: EmotionType;

  // Risk Management
  @Prop()
  stopLoss?: number;

  @Prop()
  takeProfit?: number;

  @Prop()
  riskAmount?: number;

  @Prop()
  riskPercentage?: number;

  @Prop()
  rMultiple?: number;

  // Trade Analysis
  @Prop()
  setup?: string;

  @Prop()
  strategy?: string;

  @Prop()
  timeframe?: string;

  @Prop({ min: 1, max: 10 })
  confidence?: number;

  // Results
  @Prop()
  pnl?: number;

  @Prop()
  pnlPercentage?: number;

  @Prop({ default: 0 })
  commission: number;

  @Prop()
  netPnl?: number;

  @Prop({ default: false })
  isWinner?: boolean;

  // Psychology
  @Prop({ enum: EmotionType })
  emotionBefore?: EmotionType;

  @Prop({ enum: EmotionType })
  emotionDuring?: EmotionType;

  @Prop({ enum: EmotionType })
  emotionAfter?: EmotionType;

  // Notes & Learning
  @Prop({ maxlength: 2000 })
  preTradeAnalysis?: string;

  @Prop({ maxlength: 2000 })
  postTradeNotes?: string;

  @Prop({ maxlength: 2000 })
  lessonsLearned?: string;

  @Prop({ type: [String], default: [] })
  mistakes: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  // Attachments
  @Prop({ type: [String], default: [] })
  screenshots: string[];

  // Status
  @Prop({ default: true })
  isOpen: boolean;

  @Prop({ default: false })
  isReviewed: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  // Statistics (calculated fields)
  @Prop()
  holdingTime?: number; // in minutes

  @Prop()
  maxDrawdown?: number;

  @Prop()
  maxProfit?: number;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);

// Indexes for performance
TradeSchema.index({ userId: 1, tradeDate: -1 });
TradeSchema.index({ userId: 1, symbol: 1 });
TradeSchema.index({ userId: 1, isOpen: 1 });
TradeSchema.index({ userId: 1, isWinner: 1 });
TradeSchema.index({ userId: 1, strategy: 1 });

// Virtual for calculating holding time
TradeSchema.virtual('calculatedHoldingTime').get(function() {
  if (this.exitTime && this.entryTime) {
    return Math.round((this.exitTime.getTime() - this.entryTime.getTime()) / 60000); // in minutes
  }
  return null;
});

// Pre-save hook to calculate derived fields
TradeSchema.pre('save', function(next) {
  // Calculate P/L if trade is closed
  if (this.exitPrice && this.entryPrice && this.positionSize) {
    // For OPTIONS: P&L is ALWAYS (exit - entry) because:
    // - You BUY an option (pay premium) and SELL to close (receive premium)
    // - Profit = What you received - What you paid = exit - entry
    // - This is true for BOTH calls and puts!
    //
    // For STOCKS: Use direction to determine P&L
    // - Long: profit when price goes up (exit - entry)
    // - Short: profit when price goes down (entry - exit)
    const isOptions = this.market === MarketType.OPTIONS;
    const priceDiff = isOptions
      ? this.exitPrice - this.entryPrice  // Options: always exit - entry
      : (this.direction === TradeDirection.LONG
          ? this.exitPrice - this.entryPrice
          : this.entryPrice - this.exitPrice);

    // For options, positionSize is number of contracts, each contract = 100 shares
    const contractMultiplier = isOptions ? 100 : 1;

    this.pnl = priceDiff * this.positionSize * contractMultiplier;
    this.netPnl = this.pnl - this.commission;
    this.pnlPercentage = (priceDiff / this.entryPrice) * 100;
    this.isWinner = this.netPnl > 0;

    // Calculate R-Multiple
    if (this.riskAmount && this.riskAmount !== 0) {
      this.rMultiple = this.netPnl / this.riskAmount;
    }

    // Calculate holding time
    if (this.exitTime && this.entryTime) {
      this.holdingTime = Math.round((this.exitTime.getTime() - this.entryTime.getTime()) / 60000);
    }

    // Mark as closed
    this.isOpen = false;
  }

  next();
});