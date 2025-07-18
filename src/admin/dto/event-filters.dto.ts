import { IsOptional, IsString, IsEnum, IsDateString, IsNumber, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class EventFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['master_course', 'community_event', 'general'])
  type?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['date', 'name', 'price', 'capacity', 'createdAt'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}