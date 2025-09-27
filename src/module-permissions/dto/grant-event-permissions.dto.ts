import {
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsEmail,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ModuleType } from '../module-permission.schema';

export class EventParticipant {
  @ApiProperty({ description: 'User ID if registered' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'User last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Is the user already registered in the system' })
  @IsOptional()
  isRegistered?: boolean;
}

export class GrantEventPermissionsDto {
  @ApiProperty({
    description: 'List of event participants',
    type: [EventParticipant],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventParticipant)
  participants: EventParticipant[];

  @ApiProperty({
    enum: ModuleType,
    description: 'Module types to grant access to',
    isArray: true,
  })
  @IsArray()
  @IsEnum(ModuleType, { each: true })
  moduleTypes: ModuleType[];

  @ApiProperty({
    description: 'Expiration date for the permissions',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiProperty({
    description: 'Reason for granting permissions',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: 'Event ID for reference',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  eventId?: string;

  @ApiProperty({
    description: 'Event name for reference',
    required: false,
  })
  @IsString()
  @IsOptional()
  eventName?: string;
}

export class GrantEventPermissionsResponseDto {
  @ApiProperty({ description: 'Number of permissions granted' })
  permissionsGranted: number;

  @ApiProperty({ description: 'Number of new users created' })
  usersCreated: number;

  @ApiProperty({ description: 'Number of existing users updated' })
  usersUpdated: number;

  @ApiProperty({ description: 'Total participants processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'List of created users with temporary passwords' })
  createdUsers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
    userId: string;
  }>;

  @ApiProperty({ description: 'Any errors that occurred' })
  errors: Array<{
    email: string;
    error: string;
  }>;
}