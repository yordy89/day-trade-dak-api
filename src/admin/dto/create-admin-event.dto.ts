import {
  IsString,
  IsNumber,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  Min,
  IsUrl,
  IsObject,
  IsArray,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  MASTER_COURSE = 'master_course',
  COMMUNITY_EVENT = 'community_event',
  GENERAL = 'general',
}

export class EventMetadataDto {
  @IsString()
  @IsOptional()
  hotel?: string;

  @IsString()
  @IsOptional()
  hotelAddress?: string;

  @IsBoolean()
  @IsOptional()
  includesAccommodation?: boolean;

  @IsBoolean()
  @IsOptional()
  includesMeals?: boolean;

  @IsBoolean()
  @IsOptional()
  includesSaturdayDinner?: boolean;
}

export class EventContactDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;
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

  @IsString()
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

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => EventMetadataDto)
  metadata?: EventMetadataDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  included?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  notIncluded?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requirements?: string[];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => EventContactDto)
  contact?: EventContactDto;

  @IsObject()
  @IsOptional()
  coordinates?: {
    lat?: number;
    lng?: number;
  };

  @IsString()
  @IsOptional()
  @IsEnum(['active', 'draft', 'completed'])
  status?: string;

  @IsBoolean()
  @IsOptional()
  featuredInCRM?: boolean;
}
