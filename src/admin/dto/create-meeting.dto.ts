import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDate,
  IsEnum,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMeetingDto {
  @ApiProperty({ description: 'Meeting title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Meeting description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Scheduled date and time' })
  @Type(() => Date)
  @IsDate()
  scheduledAt: Date;

  @ApiProperty({
    description: 'Duration in minutes',
    minimum: 15,
    maximum: 480,
  })
  @IsNumber()
  @Min(15)
  @Max(480)
  duration: number;

  @ApiPropertyOptional({ description: 'List of participant user IDs' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  participants?: string[];

  @ApiPropertyOptional({
    description: 'Is this a recurring meeting',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Recurrence pattern',
    enum: ['daily', 'weekly', 'monthly'],
  })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  recurringType?: string;

  @ApiPropertyOptional({
    description:
      'Days of the week for weekly recurrence (0=Sunday, 6=Saturday)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  recurringDays?: number[];

  @ApiPropertyOptional({ description: 'End date for recurring meetings' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  recurringEndDate?: Date;

  @ApiPropertyOptional({
    description: 'Time for recurring meetings (HH:mm format)',
  })
  @IsOptional()
  @IsString()
  recurringTime?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of participants',
    minimum: 2,
    maximum: 500,
    default: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(500)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Is this a public meeting',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Requires approval to join',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ description: 'Enable recording', default: false })
  @IsOptional()
  @IsBoolean()
  enableRecording?: boolean;

  @ApiPropertyOptional({ description: 'Enable chat', default: true })
  @IsOptional()
  @IsBoolean()
  enableChat?: boolean;

  @ApiPropertyOptional({ description: 'Enable screen sharing', default: true })
  @IsOptional()
  @IsBoolean()
  enableScreenShare?: boolean;

  @ApiPropertyOptional({ description: 'Enable waiting room', default: false })
  @IsOptional()
  @IsBoolean()
  enableWaitingRoom?: boolean;

  @ApiPropertyOptional({
    description: 'Type of meeting',
    enum: ['daily_live', 'mentorship', 'support', 'special_event', 'other'],
    default: 'other',
  })
  @IsOptional()
  @IsEnum(['daily_live', 'mentorship', 'support', 'special_event', 'other'])
  meetingType?: string;

  @ApiProperty({ description: 'Host user ID (required)' })
  @IsMongoId({ message: 'Host ID must be a valid user ID' })
  @IsString({ message: 'Host ID is required' })
  hostId: string;

  @ApiPropertyOptional({
    description: 'Meeting provider',
    enum: ['zoom', 'videosdk', 'livekit'],
    default: 'zoom',
  })
  @IsOptional()
  @IsEnum(['zoom', 'videosdk', 'livekit'])
  provider?: string;

  // Subscription-based access control fields
  @ApiPropertyOptional({
    description: 'List of subscription plan IDs that can access this meeting',
    type: [String],
    example: ['LiveWeeklyManual', 'MasterClases'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSubscriptions?: string[];

  @ApiPropertyOptional({
    description: 'If true, only users with allowed subscriptions can join',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  restrictedToSubscriptions?: boolean;

  @ApiPropertyOptional({
    description: 'Subscription-specific features for the meeting',
    type: 'object',
    example: {
      LiveWeeklyManual: {
        maxDuration: 60,
        canRecord: false,
        maxParticipants: 50,
        canScreenShare: true,
      },
    },
  })
  @IsOptional()
  subscriptionFeatures?: Record<
    string,
    {
      maxDuration?: number;
      canRecord?: boolean;
      maxParticipants?: number;
      canScreenShare?: boolean;
    }
  >;
}
