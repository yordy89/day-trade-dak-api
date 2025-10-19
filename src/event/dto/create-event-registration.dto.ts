import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsNumber,
} from 'class-validator';

export class CreateEventRegistrationDto {
  @IsString()
  eventId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsBoolean()
  isVip: boolean;

  @IsOptional()
  @IsEnum(['pending', 'paid', 'free'])
  paymentStatus?: 'pending' | 'paid' | 'free';

  @IsOptional()
  promoCode?: string;

  // New fields
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  additionalInfo?: object;

  @IsOptional()
  @IsEnum(['paid', 'free', 'member_exclusive'])
  registrationType?: string;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  stripeSessionId?: string;

  @IsOptional()
  @IsEnum(['card', 'klarna', 'afterpay', 'other'])
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  klarnaFee?: number;

  // Partial payment fields
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsEnum(['full', 'partial'])
  paymentMode?: 'full' | 'partial';

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  totalPaid?: number;

  @IsOptional()
  @IsNumber()
  remainingBalance?: number;

  @IsOptional()
  @IsBoolean()
  isFullyPaid?: boolean;

  @IsOptional()
  @IsNumber()
  depositPaid?: number;

  @IsOptional()
  paymentHistory?: any[];
}
