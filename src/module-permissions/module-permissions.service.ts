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
import {
  GrantEventPermissionsDto,
  GrantEventPermissionsResponseDto
} from './dto/grant-event-permissions.dto';
import {
  RevokeEventPermissionsDto,
  RevokeEventPermissionsResponseDto
} from './dto/revoke-event-permissions.dto';
import { User, UserDocument } from '../users/user.schema';
import { EventRegistration, EventRegistrationDocument } from '../event/schemas/eventRegistration.schema';
import { CustomLoggerService } from '../logger/logger.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ModulePermissionsService {
  constructor(
    @InjectModel(ModulePermission.name)
    private modulePermissionModel: Model<ModulePermissionDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    private readonly logger: CustomLoggerService,
    private readonly emailService: EmailService,
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
    // Map module types to subscription plans (can be multiple plans per module)
    const moduleToSubscriptionMap: Partial<Record<ModuleType, string | string[]>> = {
      [ModuleType.CLASSES]: 'Classes',
      [ModuleType.LIVE_WEEKLY]: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
      [ModuleType.LIVE_RECORDED]: 'LiveRecorded',
      [ModuleType.MASTER_CLASSES]: 'MasterClases',
      [ModuleType.PSICOTRADING]: 'Psicotrading',
      [ModuleType.PEACE_WITH_MONEY]: 'PeaceWithMoney',
      [ModuleType.MASTER_COURSE]: 'MasterCourse',
      [ModuleType.STOCKS]: 'Stocks',
      [ModuleType.SUPPORT_VIDEOS]: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
    };

    // Special case: Live Recorded and Support Videos are automatically accessible with Live Weekly subscriptions
    if ((moduleType === ModuleType.LIVE_RECORDED || moduleType === ModuleType.SUPPORT_VIDEOS) && user?.subscriptions) {
      const hasLiveWeekly = user.subscriptions.some((sub: any) => {
        const planName = typeof sub === 'string' ? sub : sub.plan;
        const isLiveWeekly = ['LiveWeeklyManual', 'LiveWeeklyRecurring'].includes(planName);
        
        if (typeof sub === 'string') {
          return isLiveWeekly;
        }
        
        // Check if Live Weekly subscription is active and not expired
        // Add 12-hour buffer for timezone differences to ensure users
        // have access until end of day in their local timezone
        if (isLiveWeekly && (!sub.status || sub.status === 'active')) {
          const now = new Date();
          
          // Check expiresAt with buffer
          if (sub.expiresAt) {
            const expiresDate = new Date(sub.expiresAt);
            expiresDate.setHours(expiresDate.getHours() + 12); // Add 12-hour buffer
            if (expiresDate <= now) return false;
          }
          
          // Check currentPeriodEnd with buffer
          if (sub.currentPeriodEnd) {
            const periodEndDate = new Date(sub.currentPeriodEnd);
            periodEndDate.setHours(periodEndDate.getHours() + 12); // Add 12-hour buffer
            if (periodEndDate <= now) return false;
          }
          
          return true;
        }
        
        return false;
      });
      
      if (hasLiveWeekly) {
        this.logger.log(
          `User ${userId} has automatic access to ${moduleType} via Live Weekly subscription`,
          'ModulePermissionsService',
        );
        return true;
      }
    }

    const requiredSubscriptions = moduleToSubscriptionMap[moduleType];
    if (requiredSubscriptions && user?.subscriptions) {
      // Convert to array if single string
      const acceptablePlans = Array.isArray(requiredSubscriptions) 
        ? requiredSubscriptions 
        : [requiredSubscriptions];
      
      const hasSubscription = user.subscriptions.some((sub: any) => {
        const subPlan = typeof sub === 'string' ? sub : sub.plan;
        
        // Check if plan is in acceptable plans
        if (!acceptablePlans.includes(subPlan)) {
          return false;
        }
        
        // If subscription is just a string (legacy), we can't check dates
        if (typeof sub === 'string') {
          return true;
        }
        
        // Check if subscription is active and not expired
        // Add 12-hour buffer for timezone differences to ensure users
        // have access until end of day in their local timezone
        if (!sub.status || sub.status === 'active') {
          const now = new Date();
          
          // Check expiresAt with buffer
          if (sub.expiresAt) {
            const expiresDate = new Date(sub.expiresAt);
            expiresDate.setHours(expiresDate.getHours() + 12); // Add 12-hour buffer
            if (expiresDate <= now) return false;
          }
          
          // Check currentPeriodEnd with buffer
          if (sub.currentPeriodEnd) {
            const periodEndDate = new Date(sub.currentPeriodEnd);
            periodEndDate.setHours(periodEndDate.getHours() + 12); // Add 12-hour buffer
            if (periodEndDate <= now) return false;
          }
          
          return true;
        }
        
        return false;
      });
      
      if (hasSubscription) {
        return true;
      }
    }

    // Special case: If checking Support Videos, also check if user has Live Weekly module permission
    if (moduleType === ModuleType.SUPPORT_VIDEOS) {
      const userIdStr = userId.toString();
      const liveWeeklyPermission = await this.modulePermissionModel.findOne({
        $and: [
          {
            $or: [
              { userId: userIdStr },
              { userId: userId },
            ],
          },
          { moduleType: ModuleType.LIVE_WEEKLY },
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

      if (liveWeeklyPermission) {
        this.logger.log(
          `User ${userId} has automatic access to Support Videos via Live Weekly module permission`,
          'ModulePermissionsService',
        );
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

  private generateTemporaryPassword(): string {
    // Generate a secure temporary password
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  async grantEventPermissions(
    dto: GrantEventPermissionsDto,
    grantedBy: string,
  ): Promise<GrantEventPermissionsResponseDto> {
    const response: GrantEventPermissionsResponseDto = {
      permissionsGranted: 0,
      usersCreated: 0,
      usersUpdated: 0,
      totalProcessed: 0,
      createdUsers: [],
      errors: [],
    };

    for (const participant of dto.participants) {
      try {
        let userId: string;
        let isNewUser = false;
        let temporaryPassword: string | null = null;

        // Check if user exists by email
        let user = await this.userModel.findOne({ email: participant.email });

        if (!user) {
          // Create new user
          temporaryPassword = this.generateTemporaryPassword();
          const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

          user = new this.userModel({
            email: participant.email,
            firstName: participant.firstName,
            lastName: participant.lastName,
            fullName: `${participant.firstName} ${participant.lastName}`.trim(),
            password: hashedPassword,
            role: 'user',
            status: 'active',
            subscriptions: [],
            activeSubscriptions: [],
          });

          await user.save();
          isNewUser = true;
          response.usersCreated++;

          userId = user._id.toString();

          // Add to created users list
          response.createdUsers.push({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            temporaryPassword,
            userId,
          });

          this.logger.log(
            `Created new user ${user.email} for event ${dto.eventName}`,
            'ModulePermissionsService',
          );
        } else {
          userId = user._id.toString();
          response.usersUpdated++;
        }

        // Link user to any event registrations with matching email that don't have userId
        // This ensures the registration shows the linked user after permissions are granted
        if (dto.eventId) {
          await this.eventRegistrationModel.updateMany(
            {
              eventId: dto.eventId,
              email: participant.email,
              userId: { $exists: false },
            },
            {
              $set: { userId: user._id },
            },
          );
        }
        // Also update registrations without eventId filter (by email only)
        await this.eventRegistrationModel.updateMany(
          {
            email: participant.email,
            userId: null,
          },
          {
            $set: { userId: user._id },
          },
        );

        // Grant permissions for each module type
        for (const moduleType of dto.moduleTypes) {
          try {
            // Check for existing active permission
            const existingPermission = await this.modulePermissionModel.findOne({
              userId,
              moduleType,
              isActive: true,
            });

            if (existingPermission) {
              // Update existing permission
              existingPermission.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
              existingPermission.reason = dto.reason || `Access for event: ${dto.eventName}`;
              existingPermission.grantedBy = new Types.ObjectId(grantedBy);
              existingPermission.eventId = dto.eventId ? new Types.ObjectId(dto.eventId) : undefined;
              existingPermission.eventName = dto.eventName;
              await existingPermission.save();
            } else {
              // Create new permission
              const permission = new this.modulePermissionModel({
                userId,
                moduleType,
                hasAccess: true,
                isActive: true,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
                reason: dto.reason || `Access for event: ${dto.eventName}`,
                grantedBy: new Types.ObjectId(grantedBy),
                eventId: dto.eventId ? new Types.ObjectId(dto.eventId) : undefined,
                eventName: dto.eventName,
              });
              await permission.save();
            }

            response.permissionsGranted++;
          } catch (error) {
            this.logger.error(
              `Failed to grant ${moduleType} permission to ${participant.email}: ${error.message}`,
              'ModulePermissionsService',
            );
          }
        }

        // Send welcome email to new users
        if (isNewUser && temporaryPassword) {
          try {
            await this.emailService.sendNewUserEventEmail(user.email, {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              temporaryPassword,
              eventName: dto.eventName || 'Evento de DayTradeDak',
              modules: dto.moduleTypes,
              expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
            });

            this.logger.log(
              `Welcome email sent to new user ${user.email}`,
              'ModulePermissionsService',
            );
          } catch (emailError) {
            this.logger.error(
              `Failed to send welcome email to ${user.email}: ${emailError.message}`,
              'ModulePermissionsService',
            );
            // Don't fail the whole process if email fails
          }
        }

        response.totalProcessed++;
      } catch (error) {
        response.errors.push({
          email: participant.email,
          error: error.message,
        });
        this.logger.error(
          `Failed to process participant ${participant.email}: ${error.message}`,
          'ModulePermissionsService',
        );
      }
    }

    this.logger.log(
      `Event permissions granted: ${response.permissionsGranted} permissions, ${response.usersCreated} users created, ${response.usersUpdated} users updated`,
      'ModulePermissionsService',
    );

    return response;
  }

  /**
   * Get users by event who have a specific module permission
   */
  async getUsersByEventWithModule(
    eventId: string,
    moduleType: ModuleType,
  ): Promise<any[]> {
    const permissions = await this.modulePermissionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        moduleType,
        isActive: true,
        hasAccess: true,
      })
      .populate('userId', 'firstName lastName email')
      .populate('grantedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    return permissions.map((perm: any) => ({
      permission: {
        _id: perm._id,
        moduleType: perm.moduleType,
        expiresAt: perm.expiresAt,
        grantedBy: perm.grantedBy,
        createdAt: perm.createdAt,
        eventId: perm.eventId,
        eventName: perm.eventName,
      },
      user: perm.userId,
    }));
  }

  /**
   * Get all module permissions for a specific event
   */
  async getPermissionsByEvent(eventId: string): Promise<ModulePermission[]> {
    return this.modulePermissionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        isActive: true,
      })
      .populate('userId', 'firstName lastName email')
      .populate('grantedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async bulkRevoke(
    userIds: string[],
    moduleTypes: ModuleType[],
    options: {
      revokedBy: string;
      reason?: string;
    },
  ): Promise<{
    revoked: number;
    usersAffected: number;
    affectedUsers: Array<{ userId: string; email: string; modulesRevoked: ModuleType[] }>;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const result = {
      revoked: 0,
      usersAffected: 0,
      affectedUsers: [] as Array<{ userId: string; email: string; modulesRevoked: ModuleType[] }>,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    const affectedUsersMap = new Map<string, { email: string; modulesRevoked: ModuleType[] }>();

    for (const userId of userIds) {
      try {
        // Get user email for response
        const user = await this.userModel.findById(userId);
        if (!user) {
          result.errors.push({ userId, error: 'User not found' });
          continue;
        }

        const modulesRevoked: ModuleType[] = [];

        for (const moduleType of moduleTypes) {
          // Soft delete - set isActive and hasAccess to false
          const updateResult = await this.modulePermissionModel.updateOne(
            { userId, moduleType, isActive: true },
            {
              $set: {
                isActive: false,
                hasAccess: false,
                updatedAt: new Date(),
              },
            },
          );

          if (updateResult.modifiedCount > 0) {
            result.revoked++;
            modulesRevoked.push(moduleType);
          }
        }

        if (modulesRevoked.length > 0) {
          affectedUsersMap.set(userId, {
            email: user.email,
            modulesRevoked,
          });
        }
      } catch (error) {
        result.errors.push({ userId, error: error.message });
        this.logger.error(
          `Failed to revoke permissions for user ${userId}: ${error.message}`,
          'ModulePermissionsService',
        );
      }
    }

    // Convert map to array
    for (const [userId, data] of affectedUsersMap) {
      result.affectedUsers.push({
        userId,
        email: data.email,
        modulesRevoked: data.modulesRevoked,
      });
    }

    result.usersAffected = affectedUsersMap.size;

    this.logger.log(
      `Bulk revoked ${result.revoked} permissions from ${result.usersAffected} users. Modules: ${moduleTypes.join(', ')}`,
      'ModulePermissionsService',
    );

    return result;
  }

  async revokeEventPermissions(
    dto: RevokeEventPermissionsDto,
    revokedBy: string,
  ): Promise<RevokeEventPermissionsResponseDto> {
    const result = await this.bulkRevoke(dto.userIds, dto.moduleTypes, {
      revokedBy,
      reason: dto.reason,
    });

    return {
      permissionsRevoked: result.revoked,
      usersAffected: result.usersAffected,
      affectedUsers: result.affectedUsers,
      errors: result.errors,
    };
  }
}
