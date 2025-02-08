import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/constants';

// Create a decorator to specify roles for a route
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
