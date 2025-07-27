import { IsString, IsOptional, IsNumber, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLiveKitRoomDto {
  @ApiProperty({ description: 'Meeting ID from MongoDB' })
  @IsString()
  meetingId: string;

  @ApiPropertyOptional({ description: 'Custom room name (defaults to meeting ID)' })
  @IsOptional()
  @IsString()
  roomName?: string;

  @ApiPropertyOptional({ description: 'Empty timeout in seconds', default: 300 })
  @IsOptional()
  @IsNumber()
  emptyTimeout?: number;

  @ApiPropertyOptional({ description: 'Maximum participants allowed', default: 100 })
  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Enable room recording', default: false })
  @IsOptional()
  @IsBoolean()
  enableRecording?: boolean;

  @ApiPropertyOptional({ description: 'Room metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}