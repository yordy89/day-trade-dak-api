import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Retrieve required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // If no roles are specified, the route is public
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    // SUPER_ADMIN can access everything
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Check if the user's role matches the required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }
}
