import { IsString, IsNumber, IsBoolean, IsDate, IsEnum, IsOptional, Min, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  MASTER_COURSE = 'master_course',
  COMMUNITY_EVENT = 'community_event',
  GENERAL = 'general',
}

export class CreateAdminEventDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @IsString()
  @IsOptional()
  location?: string;

  @IsUrl()
  @IsOptional()
  bannerImage?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  vipPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @IsBoolean()
  @IsOptional()
  requiresActiveSubscription?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  capacity?: number;
}