import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString, IsNumber, IsArray, IsObject } from 'class-validator';
import { AnnouncementType, AnnouncementPriority, AnnouncementStatus, DisplayFrequency } from '../announcement.schema';

export class CreateAnnouncementDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(AnnouncementType)
  @IsOptional()
  type?: AnnouncementType;

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  priority?: AnnouncementPriority;

  @IsEnum(AnnouncementStatus)
  @IsOptional()
  status?: AnnouncementStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  link?: string;

  @IsString()
  @IsOptional()
  linkText?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  backgroundColor?: string;

  @IsString()
  @IsOptional()
  textColor?: string;

  @IsString()
  @IsOptional()
  linkColor?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  dismissible?: boolean;

  @IsNumber()
  @IsOptional()
  dismissDurationHours?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetAudience?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  template?: string;

  @IsObject()
  @IsOptional()
  customStyles?: {
    headerBg?: string;
    headerText?: string;
    bodyBg?: string;
    bodyText?: string;
    buttonBg?: string;
    buttonText?: string;
    borderColor?: string;
    animation?: string;
  };

  @IsString()
  @IsOptional()
  customHtml?: string;

  @IsEnum(DisplayFrequency)
  @IsOptional()
  displayFrequency?: DisplayFrequency;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}