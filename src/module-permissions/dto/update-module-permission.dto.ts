import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateModulePermissionDto } from './create-module-permission.dto';

export class UpdateModulePermissionDto extends PartialType(
  OmitType(CreateModulePermissionDto, ['userId', 'moduleType'] as const)
) {}