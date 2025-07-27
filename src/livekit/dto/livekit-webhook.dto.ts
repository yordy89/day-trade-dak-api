import { IsString, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LiveKitWebhookDto {
  @ApiProperty({ description: 'Event type' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Room information' })
  @IsObject()
  room?: {
    sid: string;
    name: string;
    emptyTimeout: number;
    maxParticipants: number;
    creationTime: number;
    metadata: string;
    numParticipants: number;
  };

  @ApiProperty({ description: 'Participant information' })
  @IsObject()
  participant?: {
    sid: string;
    identity: string;
    state: string;
    metadata: string;
    joinedAt: number;
    name?: string;
    permission?: Record<string, boolean>;
  };

  @ApiProperty({ description: 'Event timestamp' })
  @IsNumber()
  createdAt: number;

  @ApiProperty({ description: 'Event ID' })
  @IsString()
  id: string;
}