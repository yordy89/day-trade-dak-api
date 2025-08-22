import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ModulePermission,
  ModulePermissionDocument,
  ModuleType,
} from './module-permission.schema';
import { CreateModulePermissionDto } from './dto/create-module-permission.dto';
import { UpdateModulePermissionDto } from './dto/update-module-permission.dto';
import { User, UserDocument } from '../users/user.schema';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class ModulePermissionsService {
  constructor(
    @InjectModel(ModulePermission.name)
    private modulePermissionModel: Model<ModulePermissionDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(
    createDto: CreateModulePermissionDto,
    grantedBy: string,
  ): Promise<ModulePermission> {
    // Verify user exists
    const user = await this.userModel.findById(createDto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for existing active permission
    const existingPermission = await this.modulePermissionModel.findOne({
      userId: createDto.userId,
      moduleType: createDto.moduleType,
      isActive: true,
    });

    if (existingPermission) {
      // Deactivate existing permission
      existingPermission.isActive = false;
      await existingPermission.save();
    }

    // Create new permission
    const permission = new this.modulePermissionModel({
      ...createDto,
      grantedBy: new Types.ObjectId(grantedBy),
      isActive: true,
      hasAccess: createDto.hasAccess ?? true,
    });

    const saved = await permission.save();
    this.logger.log(
      `Module permission granted: ${createDto.moduleType} for user ${createDto.userId} by ${grantedBy}`,
      'ModulePermissionsService',
    );

    return saved;
  }

  async findAllForUser(userId: string): Promise<ModulePermission[]> {
    return this.modulePermissionModel
      .find({ userId, isActive: true })
      .populate('grantedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async findAllByModule(moduleType: ModuleType): Promise<ModulePermission[]> {
    return this.modulePermissionModel
      .find({ moduleType, isActive: true, hasAccess: true })
      .populate('userId', 'firstName lastName email')
      .populate('grantedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async hasModuleAccess(
    userId: string,
    moduleType: ModuleType,
  ): Promise<boolean> {
    // Check if user is super_admin
    const user = await this.userModel.findById(userId);
    if (user?.role === 'super_admin') {
      this.logger.log(`User ${userId} is super_admin, granting access to ${moduleType}`);
      return true;
    }

    // Check if user has an active subscription for this module
    // Map module types to subscription plans
    const moduleToSubscriptionMap: Partial<Record<ModuleType, string>> = {
      [ModuleType.CLASSES]: 'Classes',
      [ModuleType.LIVE_WEEKLY]: 'LiveWeeklyManual',
      [ModuleType.LIVE_RECORDED]: 'LiveRecorded',
      [ModuleType.MASTER_CLASSES]: 'MasterClases',
      [ModuleType.PSICOTRADING]: 'Psicotrading',
    };

    // Special case: Live Recorded is automatically accessible with Live Weekly subscriptions
    if (moduleType === ModuleType.LIVE_RECORDED && user?.subscriptions) {
      const hasLiveWeekly = user.subscriptions.some((sub: any) => {
        const planName = typeof sub === 'string' ? sub : sub.plan;
        const isLiveWeekly = ['LiveWeeklyManual', 'LiveWeeklyRecurring'].includes(planName);
        
        if (typeof sub === 'string') {
          return isLiveWeekly;
        }
        
        // Check if Live Weekly subscription is active and not expired
        return isLiveWeekly && 
               (!sub.status || sub.status === 'active') &&
               (!sub.expiresAt || new Date(sub.expiresAt) > new Date()) &&
               (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > new Date());
      });
      
      if (hasLiveWeekly) {
        this.logger.log(
          `User ${userId} has automatic access to Live Recorded via Live Weekly subscription`,
          'ModulePermissionsService',
        );
        return true;
      }
    }

    const requiredSubscription = moduleToSubscriptionMap[moduleType];
    if (requiredSubscription && user?.subscriptions) {
      const hasSubscription = user.subscriptions.some((sub: any) => {
        if (typeof sub === 'string') {
          return sub === requiredSubscription;
        }
        // Check if subscription is active and not expired
        return sub.plan === requiredSubscription && 
               (!sub.status || sub.status === 'active') &&
               (!sub.expiresAt || new Date(sub.expiresAt) > new Date()) &&
               (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > new Date());
      });
      
      if (hasSubscription) {
        return true;
      }
    }

    // Check for active permission
    // Convert userId to string to handle both string and ObjectId storage
    const userIdStr = userId.toString();
    const permission = await this.modulePermissionModel.findOne({
      $and: [
        {
          $or: [
            { userId: userIdStr },
            { userId: userId },
          ],
        },
        { moduleType },
        { isActive: true },
        { hasAccess: true },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      ],
    });

    // Debug: Check all permissions for this user
    const allUserPerms = await this.modulePermissionModel.find({ 
      $or: [
        { userId: userIdStr },
        { userId: userId },
      ],
      isActive: true,
      hasAccess: true 
    });
    
    this.logger.log(
      `Module permission check for user ${userId}, module ${moduleType}: ${!!permission}. User has ${allUserPerms.length} active permissions: ${allUserPerms.map(p => p.moduleType).join(', ')}`,
      'ModulePermissionsService',
    );

    return !!permission;
  }

  async update(
    userId: string,
    moduleType: ModuleType,
    updateDto: UpdateModulePermissionDto,
  ): Promise<ModulePermission> {
    const permission = await this.modulePermissionModel.findOne({
      userId,
      moduleType,
      isActive: true,
    });

    if (!permission) {
      throw new NotFoundException('Module permission not found');
    }

    Object.assign(permission, updateDto);
    return permission.save();
  }

  async revoke(
    userId: string,
    moduleType: ModuleType,
    revokedBy: string,
  ): Promise<void> {
    const result = await this.modulePermissionModel.updateOne(
      { userId, moduleType, isActive: true },
      {
        $set: {
          isActive: false,
          hasAccess: false,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Module permission not found');
    }

    this.logger.log(
      `Module permission revoked: ${moduleType} for user ${userId} by ${revokedBy}`,
      'ModulePermissionsService',
    );
  }

  async expirePermissions(): Promise<number> {
    const result = await this.modulePermissionModel.updateMany(
      {
        isActive: true,
        hasAccess: true,
        expiresAt: { $lte: new Date() },
      },
      {
        $set: {
          isActive: false,
          hasAccess: false,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Expired ${result.modifiedCount} module permissions`,
        'ModulePermissionsService',
      );
    }

    return result.modifiedCount;
  }

  async getUsersWithModuleAccess(moduleType: ModuleType): Promise<any[]> {
    const permissions = await this.modulePermissionModel
      .find({
        moduleType,
        isActive: true,
        hasAccess: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      })
      .populate('userId', 'firstName lastName email profileImage');

    return permissions.map((p) => ({
      user: p.userId,
      permission: {
        expiresAt: p.expiresAt,
        grantedAt: (p as any).createdAt,
        reason: p.reason,
      },
    }));
  }

  async bulkGrant(
    userIds: string[],
    moduleType: ModuleType,
    options: {
      expiresAt?: Date;
      reason?: string;
      grantedBy: string;
    },
  ): Promise<any> {
    const operations = userIds.map((userId) => ({
      updateOne: {
        filter: { userId, moduleType },
        update: {
          $set: {
            hasAccess: true,
            isActive: true,
            expiresAt: options.expiresAt,
            reason: options.reason,
            grantedBy: new Types.ObjectId(options.grantedBy),
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await this.modulePermissionModel.bulkWrite(operations);

    this.logger.log(
      `Bulk granted ${moduleType} access to ${userIds.length} users`,
      'ModulePermissionsService',
    );

    return {
      granted: result.upsertedCount + result.modifiedCount,
      total: userIds.length,
    };
  }
}
