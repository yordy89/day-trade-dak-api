import { PartialType } from '@nestjs/swagger';
import { CreateCampaignDto } from './create-campaign.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { CampaignStatus } from '../schemas/campaign.schema';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}