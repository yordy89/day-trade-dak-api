import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
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
}
