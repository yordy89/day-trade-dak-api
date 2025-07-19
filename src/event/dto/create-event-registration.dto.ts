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
  @IsEnum(['card', 'klarna', 'other'])
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  klarnaFee?: number;
}
