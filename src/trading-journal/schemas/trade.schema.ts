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

  // Exit Details
  @Prop()
  exitTime?: Date;

  @Prop()
  exitPrice?: number;

  @Prop()
  exitReason?: string;

  // Risk Management
  @Prop({ required: true })
  stopLoss: number;

  @Prop()
  takeProfit?: number;

  @Prop({ required: true })
  riskAmount: number;

  @Prop({ required: true })
  riskPercentage: number;

  @Prop()
  rMultiple?: number;

  // Trade Analysis
  @Prop({ required: true })
  setup: string;

  @Prop({ required: true })
  strategy: string;

  @Prop({ required: true })
  timeframe: string;

  @Prop({ min: 1, max: 10, required: true })
  confidence: number;

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
    const priceDiff = this.direction === TradeDirection.LONG
      ? this.exitPrice - this.entryPrice
      : this.entryPrice - this.exitPrice;

    this.pnl = priceDiff * this.positionSize;
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