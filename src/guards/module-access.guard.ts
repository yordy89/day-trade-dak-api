import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleType } from '../module-permissions/module-permission.schema';
import { ModulePermissionsService } from '../module-permissions/module-permissions.service';
import { UserService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { REQUIRED_MODULE_KEY } from '../decorators/require-module.decorator';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private modulePermissionsService: ModulePermissionsService,
    private userService: UserService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<ModuleType>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true; // No module requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // 1. Check if user is super_admin
    if (user.role === 'super_admin') {
      return true;
    }

    // 2. Check module permissions
    const hasModulePermission =
      await this.modulePermissionsService.hasModuleAccess(
        user._id.toString(),
        requiredModule,
      );

    if (hasModulePermission) {
      return true;
    }

    // 3. Check subscription-based access
    const hasSubscriptionAccess = await this.checkSubscriptionAccess(
      user._id.toString(),
      requiredModule,
    );

    if (hasSubscriptionAccess) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. You need an active subscription or permission for ${requiredModule}`,
    );
  }

  private async checkSubscriptionAccess(
    userId: string,
    moduleType: ModuleType,
  ): Promise<boolean> {
    const user = await this.userService.findById(userId);
    if (!user) return false;

    // Map module types to subscription plans
    const moduleToSubscriptionMap: Record<ModuleType, string[]> = {
      [ModuleType.CLASSES]: ['Classes'],
      [ModuleType.MASTER_CLASSES]: ['MasterClases'],
      [ModuleType.LIVE_RECORDED]: ['LiveRecorded'],
      [ModuleType.PSICOTRADING]: ['Psicotrading'],
      [ModuleType.PEACE_WITH_MONEY]: ['PeaceWithMoney'],
      [ModuleType.LIVE_WEEKLY]: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
      [ModuleType.COMMUNITY_EVENTS]: ['CommunityEvent'],
      [ModuleType.VIP_EVENTS]: ['VipEvent'],
      [ModuleType.MASTER_COURSE]: ['MasterCourse'],
      [ModuleType.STOCKS]: ['Stocks'],
      [ModuleType.SUPPORT_VIDEOS]: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
      [ModuleType.TRADING_JOURNAL]: [], // No subscription mapping - access via module permission only
    };

    const requiredPlans = moduleToSubscriptionMap[moduleType];
    if (!requiredPlans || requiredPlans.length === 0) {
      return false;
    }

    // Check if user has any of the required subscriptions
    const activeSubscriptions = user.subscriptions.filter((sub) => {
      // Check if subscription is not expired
      if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
        return false;
      }
      // Check if it's an active subscription
      if (sub.status && sub.status !== 'active') {
        return false;
      }
      return requiredPlans.includes(sub.plan);
    });

    return activeSubscriptions.length > 0;
  }
}
