import {
  IsString,
  IsArray,
  IsEmail,
  IsOptional,
  IsObject,
} from 'class-validator';

export class SendTestEmailDto {
  @IsString()
  campaignId: string;

  @IsArray()
  @IsEmail({}, { each: true })
  testEmails: string[];

  @IsOptional()
  @IsObject()
  testData?: Record<string, any>;
}