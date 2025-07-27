import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModuleType } from '../module-permission.schema';

export class CreateModulePermissionDto {
  @ApiProperty({ description: 'User ID to grant permission to' })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    enum: ModuleType,
    description: 'Module type to grant access to',
  })
  @IsEnum(ModuleType)
  moduleType: ModuleType;

  @ApiProperty({
    description: 'Whether to grant or revoke access',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  hasAccess?: boolean = true;

  @ApiProperty({
    description: 'Expiration date for the permission',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiProperty({
    description: 'Reason for granting permission',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
