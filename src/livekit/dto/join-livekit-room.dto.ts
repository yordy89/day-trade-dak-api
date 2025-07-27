import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinLiveKitRoomDto {
  @ApiProperty({ description: 'Participant identity (usually user ID)' })
  @IsString()
  identity: string;

  @ApiProperty({ description: 'Participant display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Can publish audio/video', default: true })
  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @ApiPropertyOptional({ description: 'Can subscribe to others', default: true })
  @IsOptional()
  @IsBoolean()
  canSubscribe?: boolean;

  @ApiPropertyOptional({ description: 'Can publish data messages', default: true })
  @IsOptional()
  @IsBoolean()
  canPublishData?: boolean;

  @ApiPropertyOptional({ description: 'Hidden participant (for recording)', default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ description: 'Participant metadata' })
  @IsOptional()
  @IsString()
  metadata?: string;
}