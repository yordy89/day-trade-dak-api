import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InquiryType } from '../contact-message.schema';

export class CreateContactMessageDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsEnum(InquiryType)
  inquiryType: InquiryType;

  @IsNotEmpty()
  @IsString()
  message: string;
}