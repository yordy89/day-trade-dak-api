import {
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExitReason, EmotionType } from '../schemas/trade.schema';

export class CloseTradeDto {
  @ApiProperty({ description: 'Exit price of the trade', example: 178.50 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  exitPrice: number;

  @ApiProperty({ description: 'Exit time', example: '2025-11-10T14:30:00Z' })
  @IsNotEmpty()
  @IsDateString()
  exitTime: string;

  @ApiProperty({
    enum: ExitReason,
    description: 'Structured exit reason',
    example: ExitReason.HIT_TAKE_PROFIT,
  })
  @IsNotEmpty()
  @IsEnum(ExitReason)
  exitReasonType: ExitReason;

  @ApiProperty({
    description: 'Additional notes about exit decision',
    example: 'Market showed resistance at this level',
    required: false,
  })
  @IsOptional()
  @IsString()
  exitReasonNotes?: string;

  // Options-specific fields
  @ApiProperty({
    description: 'Exit premium for options trades (selling price per share)',
    example: 6.25,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exitPremium?: number;

  @ApiProperty({
    description: 'Underlying stock price at exit (for options)',
    example: 185.50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  underlyingPriceAtExit?: number;

  // Self-reflection
  @ApiProperty({
    description: 'What the trader learned from this trade',
    example: 'Should have taken partial profits at 2R',
    required: false,
  })
  @IsOptional()
  @IsString()
  lessonsLearnedOnExit?: string;

  @ApiProperty({
    description: 'Would the trader take this trade again?',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  wouldRepeatTrade?: boolean;

  @ApiProperty({
    enum: EmotionType,
    description: 'Emotional state when exiting',
    example: EmotionType.CONFIDENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(EmotionType)
  exitEmotionState?: EmotionType;
}
