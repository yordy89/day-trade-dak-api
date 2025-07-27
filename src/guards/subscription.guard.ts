import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/constants';
import { SubscriptionPlan } from 'src/users/user.dto';
import { UserService } from 'src/users/users.service';
import { REQUIRED_MODULE_KEY } from 'src/decorators/require-module.decorator';
import { ModuleType } from 'src/module-permissions/module-permission.schema';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Retrieve required subscription plans from the decorator
    const requiredPlans = this.reflector.get<SubscriptionPlan[]>(
      'subscriptionPlans',
      context.getHandler(),
    );

    if (!requiredPlans || requiredPlans.length === 0) {
      return true; // No specific subscription required, allow access
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?._id as string;

    if (!userId) {
      throw new ForbiddenException('User not authenticated.');
    }

    // Fetch user from database
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new ForbiddenException('User not found.');
    }

    // ✅ Check if user has at least one active required subscription
    console.log('SubscriptionGuard - Required plans:', requiredPlans);
    console.log('SubscriptionGuard - User subscriptions:', user.subscriptions);
    console.log('SubscriptionGuard - User role:', user.role);
    
    const hasValidSubscription =
      user.subscriptions.some(
        (sub) => {
          const isValidPlan = requiredPlans.includes(sub.plan);
          // Check both expiresAt and currentPeriodEnd for expiration
          const expirationDate = sub.expiresAt || sub.currentPeriodEnd;
          const isNotExpired = !expirationDate || new Date(expirationDate) > new Date();
          // Check if subscription is active (if status field exists)
          const isActive = !sub.status || sub.status === 'active';
          console.log(`Checking subscription: ${sub.plan}, Valid plan: ${isValidPlan}, Not expired: ${isNotExpired}, Active: ${isActive}, Status: ${sub.status}, ExpiresAt: ${sub.expiresAt}, CurrentPeriodEnd: ${sub.currentPeriodEnd}`);
          return isValidPlan && isNotExpired && isActive;
        }
      ) || user.role === 'super_admin'; // ✅ Allow access only for super_admin
    
    console.log('SubscriptionGuard - Has valid subscription:', hasValidSubscription);

    // Check if there's also a module requirement - if so, let ModuleAccessGuard handle it
    const requiredModule = this.reflector.getAllAndOverride<ModuleType>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!hasValidSubscription) {
      // If there's a module requirement, don't throw here - let ModuleAccessGuard check
      if (requiredModule) {
        return true; // Pass to next guard (ModuleAccessGuard)
      }
      
      throw new ForbiddenException(
        `You need an active ${requiredPlans.join(' or ')} subscription to access this content.`,
      );
    }

    return true; // ✅ Allow access if user has a valid subscription
  }
}
