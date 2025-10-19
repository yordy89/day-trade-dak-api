import { IsString, IsNumber, IsOptional, IsEnum, Min, IsObject, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MakePaymentDto {
  @ApiProperty({ description: 'Amount to pay in USD', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['card', 'klarna', 'afterpay', 'bank_transfer']
  })
  @IsOptional()
  @IsEnum(['card', 'klarna', 'afterpay', 'bank_transfer'])
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class SearchRegistrationDto {
  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Registration ID' })
  @IsOptional()
  @IsString()
  registrationId?: string;

  @ApiPropertyOptional({ description: 'Event ID to filter by' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({ description: 'Event type to filter by (master_course, community_event, etc.)' })
  @IsOptional()
  @IsString()
  eventType?: string;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({
    description: 'Payment mode',
    enum: ['full_only', 'partial_allowed']
  })
  @IsOptional()
  @IsEnum(['full_only', 'partial_allowed'])
  paymentMode?: 'full_only' | 'partial_allowed';

  @ApiPropertyOptional({ description: 'Minimum deposit amount in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumDepositAmount?: number;

  @ApiPropertyOptional({ description: 'Deposit percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositPercentage?: number;

  @ApiPropertyOptional({ description: 'Minimum installment amount in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumInstallmentAmount?: number;

  @ApiPropertyOptional({ description: 'Allowed financing plan IDs' })
  @IsOptional()
  @IsString({ each: true })
  allowedFinancingPlans?: string[];

  @ApiPropertyOptional({ description: 'Allow custom payment plans' })
  @IsOptional()
  allowCustomPaymentPlan?: boolean;

  @ApiPropertyOptional({ description: 'Payment settings object' })
  @IsOptional()
  @IsObject()
  paymentSettings?: {
    enablePartialPayments?: boolean;
    autoReminderDays?: number[];
    gracePeriodDays?: number;
    lateFeeAmount?: number;
    lateFeePercentage?: number;
    maxPaymentAttempts?: number;
  };
}