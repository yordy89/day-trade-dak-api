import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class PaymentSuccessDto {
  @ApiProperty({ description: 'Stripe checkout session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'User ID (optional)', required: false })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class PaymentSuccessResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  subscription?: {
    plan: string;
    status: string;
    expiresAt?: Date;
  };

  @ApiProperty({ required: false })
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({ required: false })
  redirectUrl?: string;
}
