import { Exclude } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from 'src/constants';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role: Role;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  allowLiveMeetingAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLiveWeeklyAccess?: boolean;
}

export class UserEntity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: Role;
}

export enum TradingPhases {
  PHASE_ONE = 1,
  PHASE_TWO = 2,
  PHASE_THREE = 3,
  PHASE_FOUR = 4,
  PHASE_FIVE = 5,
  PHASE_SIX = 6,
  PHASE_SEVEN = 7,
  PHASE_EIGHT = 8,
  PHASE_NINE = 9,
  PHASE_TEN = 10,
}

export enum SubscriptionPlan {
  // Community Subscriptions (Weekly)
  LIVE_WEEKLY_MANUAL = 'LiveWeeklyManual',
  LIVE_WEEKLY_RECURRING = 'LiveWeeklyRecurring',

  // Recurring Monthly Subscriptions
  MASTER_CLASES = 'MasterClases',
  LIVE_RECORDED = 'LiveRecorded',
  PSICOTRADING = 'Psicotrading',
  STOCKS = 'Stocks',

  // One-Time Purchases
  CLASSES = 'Classes',
  PEACE_WITH_MONEY = 'PeaceWithMoney',
  MASTER_COURSE = 'MasterCourse',
  COMMUNITY_EVENT = 'CommunityEvent',
  VIP_EVENT = 'VipEvent',
}
