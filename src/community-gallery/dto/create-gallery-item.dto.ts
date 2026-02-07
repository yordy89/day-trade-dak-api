import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { GalleryItemType } from '../gallery-item.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGalleryItemDto {
  @ApiProperty({ enum: GalleryItemType })
  @IsEnum(GalleryItemType)
  type: GalleryItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateGalleryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderGalleryItemsDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  itemIds: string[];
}
