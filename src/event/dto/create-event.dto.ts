import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsDate,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date: string; // IMPORTANT: use string not Date type here

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  vipPrice?: number;

  @IsOptional()
  @IsString()
  bannerImage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['master_course', 'community_event', 'general', 'workshop', 'webinar', 'seminar', 'bootcamp', 'conference'])
  type?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  requiresActiveSubscription?: boolean;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  currentRegistrations?: number;

  @IsOptional()
  @IsBoolean()
  showInLandingPage?: boolean;

  @IsOptional()
  metadata?: any;
}
