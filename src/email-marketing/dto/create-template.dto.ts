import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateCategory } from '../schemas/email-template.schema';

class TemplateVariableDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsString()
  htmlContent: string;

  @IsOptional()
  @IsObject()
  jsonConfig?: object;

  @IsOptional()
  @IsObject()
  defaultValues?: {
    subject?: string;
    previewText?: string;
    [key: string]: any;
  };

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}