import { IsEnum, IsNotEmpty, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SettingCategory, SettingType } from '../interfaces/setting.interface';

class SettingMetadataDto {
  @IsNotEmpty()
  label: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  placeholder?: string;

  @IsOptional()
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };

  @IsOptional()
  order?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  editable?: boolean;
}

export class CreateSettingDto {
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: any;

  @IsEnum(SettingType)
  type: SettingType;

  @IsEnum(SettingCategory)
  category: SettingCategory;

  @ValidateNested()
  @Type(() => SettingMetadataDto)
  metadata: SettingMetadataDto;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}