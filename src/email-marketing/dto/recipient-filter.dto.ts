import {
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsEmail,
  Min,
  Max,
} from 'class-validator';

export class RecipientFilterDto {
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
  @IsDateString()
  registrationStartDate?: string;

  @IsOptional()
  @IsDateString()
  registrationEndDate?: string;

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

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class PreviewRecipientsDto extends RecipientFilterDto {
  @IsOptional()
  @IsBoolean()
  countOnly?: boolean;
}