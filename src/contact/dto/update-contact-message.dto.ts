import { IsEnum, IsOptional } from 'class-validator';
import { ContactMessageStatus } from '../contact-message.schema';

export class UpdateContactMessageDto {
  @IsOptional()
  @IsEnum(ContactMessageStatus)
  status?: ContactMessageStatus;
}