import { PartialType } from '@nestjs/mapped-types';
import { CreateSettingDto } from './create-setting.dto';
import { IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingDto extends PartialType(CreateSettingDto) {
  @IsOptional()
  lastModifiedBy?: string;
}

export class UpdateSettingValueDto {
  @IsOptional()
  value: any;

  @IsOptional()
  lastModifiedBy?: string;
}

export class SettingUpdateItem {
  @IsString()
  key: string;

  @IsOptional()
  value: any;
}

export class BulkUpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingUpdateItem)
  settings: SettingUpdateItem[];

  @IsOptional()
  lastModifiedBy?: string;
}