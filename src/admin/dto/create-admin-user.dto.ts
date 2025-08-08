import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { Role } from 'src/constants';

export class CreateAdminUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'banned'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  allowLiveMeetingAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLiveWeeklyAccess?: boolean;
}