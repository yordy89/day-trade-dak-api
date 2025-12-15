import { IsArray, IsEnum, IsString, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModuleType } from '../module-permission.schema';

export class RevokeEventPermissionsDto {
  @ApiProperty({
    description: 'List of user IDs to revoke permissions from',
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  userIds: string[];

  @ApiProperty({
    enum: ModuleType,
    description: 'Module types to revoke access from',
    isArray: true,
  })
  @IsArray()
  @IsEnum(ModuleType, { each: true })
  moduleTypes: ModuleType[];

  @ApiProperty({
    description: 'Event ID for reference',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  eventId?: string;

  @ApiProperty({
    description: 'Reason for revoking permissions',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RevokeEventPermissionsResponseDto {
  @ApiProperty({ description: 'Number of permissions revoked' })
  permissionsRevoked: number;

  @ApiProperty({ description: 'Number of users affected' })
  usersAffected: number;

  @ApiProperty({ description: 'List of affected users' })
  affectedUsers: Array<{
    userId: string;
    email: string;
    modulesRevoked: ModuleType[];
  }>;

  @ApiProperty({ description: 'Any errors that occurred' })
  errors: Array<{
    userId: string;
    error: string;
  }>;
}
