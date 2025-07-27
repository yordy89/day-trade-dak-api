import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions/permissions.service';
import { Role } from '../constants';
import { PermissionSet } from '../permissions/permission.schema';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: (keyof PermissionSet)[]) =>
  Reflect.metadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      (keyof PermissionSet)[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admin bypass - always has all permissions
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionsService.hasPermission(
        user._id.toString(),
        permission,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Missing required permission: ${permission}`,
        );
      }
    }

    return true;
  }
}
