import {
  IsMongoId,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDate,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackRating } from '../schemas/feedback.schema';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Trade ID to provide feedback for' })
  @IsMongoId()
  tradeId: string;

  @ApiProperty({ description: 'Student ID receiving feedback' })
  @IsMongoId()
  studentId: string;

  // Structured Feedback
  @ApiPropertyOptional({ description: 'Identified strengths', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @ApiPropertyOptional({ description: 'Areas for improvement', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];

  @ApiPropertyOptional({ description: 'Patterns identified', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patternsIdentified?: string[];

  // Detailed Review
  @ApiPropertyOptional({ description: 'Entry analysis', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  entryAnalysis?: string;

  @ApiPropertyOptional({ description: 'Exit analysis', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exitAnalysis?: string;

  @ApiPropertyOptional({ description: 'Risk management review', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  riskManagementReview?: string;

  @ApiPropertyOptional({ description: 'Psychology notes', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  psychologyNotes?: string;

  @ApiPropertyOptional({ description: 'Setup quality review', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  setupQualityReview?: string;

  // Recommendations
  @ApiPropertyOptional({ description: 'Recommendations', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendations?: string[];

  @ApiPropertyOptional({ description: 'Suggested resources', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedResources?: string[];

  @ApiPropertyOptional({ description: 'Action items', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  // Ratings
  @ApiProperty({
    enum: FeedbackRating,
    description: 'Overall rating',
    minimum: 1,
    maximum: 5
  })
  @IsEnum(FeedbackRating)
  overallRating: FeedbackRating;

  @ApiProperty({
    enum: FeedbackRating,
    description: 'Risk management rating',
    minimum: 1,
    maximum: 5
  })
  @IsEnum(FeedbackRating)
  riskManagementRating: FeedbackRating;

  @ApiProperty({
    enum: FeedbackRating,
    description: 'Execution rating',
    minimum: 1,
    maximum: 5
  })
  @IsEnum(FeedbackRating)
  executionRating: FeedbackRating;

  @ApiPropertyOptional({
    enum: FeedbackRating,
    description: 'Psychology rating',
    minimum: 1,
    maximum: 5
  })
  @IsOptional()
  @IsEnum(FeedbackRating)
  psychologyRating?: FeedbackRating;

  @ApiPropertyOptional({
    enum: FeedbackRating,
    description: 'Analysis rating',
    minimum: 1,
    maximum: 5
  })
  @IsOptional()
  @IsEnum(FeedbackRating)
  analysisRating?: FeedbackRating;

  // Priority & Follow-up
  @ApiPropertyOptional({ description: 'Requires follow-up', default: false })
  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @ApiPropertyOptional({ description: 'Follow-up date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  followUpDate?: Date;

  @ApiPropertyOptional({ description: 'Pin this feedback', default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}