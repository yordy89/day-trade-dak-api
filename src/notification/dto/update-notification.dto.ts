import { IsEnum, IsOptional } from 'class-validator';
import { NotificationStatus } from '../notification.schema';

export class UpdateNotificationDto {
  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;
}