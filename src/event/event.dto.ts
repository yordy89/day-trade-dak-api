import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';

import { PartialType } from '@nestjs/mapped-types';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  start: string; // Full date-time format

  @IsDateString()
  end: string; // Full date-time format

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsBoolean()
  allDay: boolean;

  @IsEnum(['global', 'personal', 'earnings'])
  type: string;

  @IsOptional()
  @IsString()
  userId?: string; // Only for personal events
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}
