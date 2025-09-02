import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsEmail,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignType } from '../schemas/campaign.schema';

class RecipientFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subscriptions?: string[];

  @IsOptional()
  @IsBoolean()
  noSubscription?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modulePermissions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  lastLoginDays?: number;

  @IsOptional()
  @IsObject()
  registrationDateRange?: {
    start?: Date;
    end?: Date;
  };

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  customEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  brevoListIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  excludeListIds?: number[];

  @IsOptional()
  @IsString()
  savedSegmentId?: string;
}

class ABTestingVariantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

class ABTestingDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ABTestingVariantDto)
  variants?: ABTestingVariantDto[];

  @IsOptional()
  @IsString()
  winnerCriteria?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  testDuration?: number;
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  previewText?: string;

  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsObject()
  jsonContent?: object;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientFiltersDto)
  recipientFilters?: RecipientFiltersDto;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipientEmails?: string[];

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  testEmails?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ABTestingDto)
  abTesting?: ABTestingDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}