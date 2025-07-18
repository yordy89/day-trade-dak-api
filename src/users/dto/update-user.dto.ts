import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  recoveryToken?: string;

  @IsOptional()
  @IsNumber()
  tradingPhase?: number;

  @IsOptional()
  @IsNumber()
  openaiMessagesCount?: number;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}
