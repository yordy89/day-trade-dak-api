import { IsString, IsNumber, IsEmail, IsOptional, IsEnum, Min, IsObject, IsPhoneNumber, IsBoolean, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InitiatePartialPaymentDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  eventId: string;

  @ApiProperty({ description: 'User first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'User last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'Initial deposit amount in USD', minimum: 0 })
  @IsNumber()
  @Min(0)
  depositAmount: number;

  @ApiPropertyOptional({ description: 'User ID if logged in' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Financing plan ID if using installment plan' })
  @IsOptional()
  @IsString()
  financingPlanId?: string;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['card', 'klarna', 'afterpay', 'local_financing']
  })
  @IsOptional()
  @IsEnum(['card', 'klarna', 'afterpay', 'local_financing'])
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Additional registration information' })
  @IsOptional()
  @IsObject()
  additionalInfo?: any;

  @ApiPropertyOptional({ description: 'Promo or affiliate code' })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Affiliate code' })
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  @ApiPropertyOptional({ description: 'Whether to create installment plan' })
  @IsOptional()
  @IsBoolean()
  createInstallmentPlan?: boolean;

  @ApiPropertyOptional({ description: 'Number of installments if creating plan' })
  @IsOptional()
  @IsNumber()
  @Min(2)
  numberOfInstallments?: number;

  @ApiPropertyOptional({
    description: 'Installment frequency',
    enum: ['weekly', 'biweekly', 'monthly']
  })
  @IsOptional()
  @IsEnum(['weekly', 'biweekly', 'monthly'])
  installmentFrequency?: string;
}