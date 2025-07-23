import { SetMetadata } from '@nestjs/common';
import { ModuleType } from '../module-permissions/module-permission.schema';

export const REQUIRED_MODULE_KEY = 'requiredModule';
export const RequireModule = (module: ModuleType) =>
  SetMetadata(REQUIRED_MODULE_KEY, module);