import {
  IsDate,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsBoolean,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketType, TradeDirection, EmotionType } from '../schemas/trade.schema';

export class CreateTradeDto {
  @ApiProperty({ description: 'Date of the trade' })
  @IsDate()
  @Type(() => Date)
  tradeDate: Date;

  @ApiProperty({ description: 'Trading symbol', example: 'AAPL' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: MarketType, description: 'Market type' })
  @IsEnum(MarketType)
  market: MarketType;

  // Entry Details
  @ApiProperty({ description: 'Entry time' })
  @IsDate()
  @Type(() => Date)
  entryTime: Date;

  @ApiProperty({ description: 'Entry price', example: 150.50 })
  @IsNumber()
  @Min(0)
  entryPrice: number;

  @ApiProperty({ description: 'Position size (number of shares/contracts)', example: 100 })
  @IsNumber()
  @Min(0)
  positionSize: number;

  @ApiProperty({ enum: TradeDirection, description: 'Trade direction' })
  @IsEnum(TradeDirection)
  direction: TradeDirection;

  // Exit Details (optional for open trades)
  @ApiPropertyOptional({ description: 'Exit time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  exitTime?: Date;

  @ApiPropertyOptional({ description: 'Exit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exitPrice?: number;

  @ApiPropertyOptional({ description: 'Reason for exit' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  exitReason?: string;

  // Risk Management
  @ApiProperty({ description: 'Stop loss price', example: 148.00 })
  @IsNumber()
  stopLoss: number;

  @ApiPropertyOptional({ description: 'Take profit price', example: 155.00 })
  @IsOptional()
  @IsNumber()
  takeProfit?: number;

  @ApiProperty({ description: 'Risk amount in currency', example: 250 })
  @IsNumber()
  @Min(0)
  riskAmount: number;

  @ApiProperty({ description: 'Risk percentage of account', example: 1.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  riskPercentage: number;

  // Trade Analysis
  @ApiProperty({ description: 'Trade setup used', example: 'Breakout' })
  @IsString()
  @MaxLength(100)
  setup: string;

  @ApiProperty({ description: 'Trading strategy (optional)', example: 'Momentum Trading', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  strategy?: string;

  @ApiProperty({ description: 'Timeframe (optional)', example: '15m', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  timeframe?: string;

  @ApiProperty({ description: 'Confidence level', minimum: 1, maximum: 10, example: 8 })
  @IsNumber()
  @Min(1)
  @Max(10)
  confidence: number;

  // Commission
  @ApiPropertyOptional({ description: 'Commission paid', default: 0, example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  // Psychology
  @ApiPropertyOptional({ enum: EmotionType, description: 'Emotion before trade' })
  @IsOptional()
  @IsEnum(EmotionType)
  emotionBefore?: EmotionType;

  @ApiPropertyOptional({ enum: EmotionType, description: 'Emotion during trade' })
  @IsOptional()
  @IsEnum(EmotionType)
  emotionDuring?: EmotionType;

  @ApiPropertyOptional({ enum: EmotionType, description: 'Emotion after trade' })
  @IsOptional()
  @IsEnum(EmotionType)
  emotionAfter?: EmotionType;

  // Notes & Learning
  @ApiPropertyOptional({ description: 'Pre-trade analysis', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preTradeAnalysis?: string;

  @ApiPropertyOptional({ description: 'Post-trade notes', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  postTradeNotes?: string;

  @ApiPropertyOptional({ description: 'Lessons learned', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lessonsLearned?: string;

  @ApiPropertyOptional({ description: 'Mistakes made', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mistakes?: string[];

  @ApiPropertyOptional({ description: 'Tags for categorization', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Screenshot URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];
}