import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  IsDate,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MarketType, TradeDirection } from '../schemas/trade.schema';

export enum TimeFilter {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  ALL = 'all',
  CUSTOM = 'custom',
}

export enum TradeResult {
  WINNERS = 'winners',
  LOSERS = 'losers',
  BREAKEVEN = 'breakeven',
  ALL = 'all',
}

export class FilterTradesDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: TimeFilter, description: 'Time filter preset' })
  @IsOptional()
  @IsEnum(TimeFilter)
  timeFilter?: TimeFilter;

  @ApiPropertyOptional({ description: 'Start date for custom range' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for custom range' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by symbol' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ enum: MarketType, description: 'Filter by market' })
  @IsOptional()
  @IsEnum(MarketType)
  market?: MarketType;

  @ApiPropertyOptional({ enum: TradeDirection, description: 'Filter by direction' })
  @IsOptional()
  @IsEnum(TradeDirection)
  direction?: TradeDirection;

  @ApiPropertyOptional({ description: 'Filter by strategy' })
  @IsOptional()
  @IsString()
  strategy?: string;

  @ApiPropertyOptional({ description: 'Filter by setup' })
  @IsOptional()
  @IsString()
  setup?: string;

  @ApiPropertyOptional({ enum: TradeResult, description: 'Filter by trade result' })
  @IsOptional()
  @IsEnum(TradeResult)
  result?: TradeResult;

  @ApiPropertyOptional({ description: 'Only open trades' })
  @IsOptional()
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only reviewed trades' })
  @IsOptional()
  @IsBoolean()
  reviewedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Minimum R-Multiple' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRMultiple?: number;

  @ApiPropertyOptional({ description: 'Maximum R-Multiple' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRMultiple?: number;

  @ApiPropertyOptional({ description: 'Sort field', default: 'tradeDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'tradeDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}