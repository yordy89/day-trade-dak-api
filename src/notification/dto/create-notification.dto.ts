import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, NotificationPriority } from '../notification.schema';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsString()
  @IsOptional()
  actionUrl?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  recipient?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;
}