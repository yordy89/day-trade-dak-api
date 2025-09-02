import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecipientFilterDto } from './recipient-filter.dto';

export class CreateSegmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => RecipientFilterDto)
  filters: RecipientFilterDto;

  @IsOptional()
  @IsBoolean()
  isDynamic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}