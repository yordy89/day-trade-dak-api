import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePermissionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  dashboard?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  users?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  subscriptions?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  payments?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  meetings?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  events?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  financing?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  messages?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  content?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  courses?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  announcements?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  analytics?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transactions?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  reports?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  settings?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  auditLogs?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  permissions?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  contactMessages?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  modulePermissions?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  affiliates?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tradingJournal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chatbot?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  communityGallery?: boolean;
}
