import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionPlan } from 'src/users/user.dto';
import { UserService } from 'src/users/users.service';

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
    const hasValidSubscription = user.subscriptions.some(
      (sub) =>
        requiredPlans.includes(sub.plan) &&
        (!sub.expiresAt || sub.expiresAt > new Date()), // ✅ Subscription is active (not expired)
    );

    if (!hasValidSubscription) {
      throw new ForbiddenException(
        `You need an active ${requiredPlans.join(' or ')} subscription to access this content.`,
      );
    }

    return true; // ✅ Allow access if user has a valid subscription
  }
}
