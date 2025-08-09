import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Permission,
  PermissionDocument,
  PermissionSet,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
} from './permission.schema';
import { User, UserDocument } from '../users/user.schema';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Role } from '../constants';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAllAdminUsers() {
    // Get all users with admin or super_admin role
    const adminUsers = await this.userModel
      .find({
        role: { $in: [Role.ADMIN, Role.SUPER_ADMIN] },
      })
      .select('_id email firstName lastName role status')
      .lean();

    // Get permissions for all admin users
    const userIds = adminUsers.map((user) => user._id);
    const permissions = await this.permissionModel
      .find({
        userId: { $in: userIds },
      })
      .lean();

    // Create a map for quick lookup
    const permissionsMap = new Map(
      permissions.map((p) => [p.userId.toString(), p.permissions]),
    );

    // Combine user data with permissions, ensuring all keys are present
    return adminUsers.map((user) => {
      const userPermissions = permissionsMap.get(user._id.toString());
      const fullPermissions = userPermissions 
        ? this.ensureAllPermissionKeys(userPermissions)
        : this.getDefaultPermissions(user.role);
      
      return {
        ...user,
        permissions: fullPermissions,
      };
    });
  }

  async findUserPermissions(userId: string): Promise<PermissionSet> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Super admin always has all permissions
    if (user.role === Role.SUPER_ADMIN) {
      return this.ensureAllPermissionKeys(DEFAULT_SUPER_ADMIN_PERMISSIONS);
    }

    // Regular users have no admin permissions  
    if (user.role === Role.USER) {
      return this.ensureAllPermissionKeys({});
    }

    // Check for existing permissions - try both string and ObjectId
    const userObjectId = new Types.ObjectId(userId);
    const permission = await this.permissionModel.findOne({
      $or: [
        { userId: userId }, // Try as string
        { userId: userObjectId } // Try as ObjectId
      ]
    }).lean();

    if (permission && permission.permissions) {
      return this.ensureAllPermissionKeys(permission.permissions);
    }

    // Return default permissions for admin role
    return this.getDefaultPermissions(user.role);
  }

  async updateUserPermissions(
    userId: string,
    updateDto: UpdatePermissionDto,
    modifiedBy: string,
  ): Promise<Permission> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cannot modify super admin permissions
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify super admin permissions');
    }

    // Cannot modify permissions for regular users
    if (user.role === Role.USER) {
      throw new ForbiddenException(
        'Regular users cannot have admin permissions',
      );
    }

    // Ensure all permission keys are present
    const fullPermissions = this.ensureAllPermissionKeys(updateDto);
    
    console.log('Full permissions to save:', JSON.stringify(fullPermissions, null, 2));
    console.log('Looking for userId:', userId);

    // Try to find by both string and ObjectId since database might have mixed types
    const userObjectId = new Types.ObjectId(userId);

    // First, check if a permission document exists (try both string and ObjectId)
    const existingPermission = await this.permissionModel.findOne({
      $or: [
        { userId: userId }, // Try as string
        { userId: userObjectId } // Try as ObjectId
      ]
    });
    console.log('Existing permission found:', existingPermission ? 'Yes' : 'No');
    
    if (existingPermission) {
      console.log('Existing permissions:', JSON.stringify(existingPermission.permissions, null, 2));
      console.log('UserId type in DB:', typeof existingPermission.userId, existingPermission.userId);
    }

    // Use findOneAndUpdate with $set to ensure proper update
    const permission = await this.permissionModel.findOneAndUpdate(
      {
        $or: [
          { userId: userId }, // Try as string
          { userId: userObjectId } // Try as ObjectId
        ]
      },
      {
        $set: {
          permissions: fullPermissions,
          lastModifiedBy: new Types.ObjectId(modifiedBy),
          updatedAt: new Date(),
        },
      },
      {
        new: true, // Return the updated document
        upsert: true, // Create if doesn't exist
        runValidators: true, // Run schema validators
        setDefaultsOnInsert: true,
      },
    );

    if (!permission) {
      throw new Error('Failed to update permissions');
    }

    console.log('Saved permission document:', JSON.stringify(permission.permissions, null, 2));
    
    // Verify the save by fetching again (check both string and ObjectId)
    const verifyPermission = await this.permissionModel.findOne({
      $or: [
        { userId: userId },
        { userId: userObjectId }
      ]
    });
    console.log('Verification - permissions after save:', JSON.stringify(verifyPermission?.permissions, null, 2));

    return permission;
  }

  async resetUserPermissions(
    userId: string,
    modifiedBy: string,
  ): Promise<Permission> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot reset super admin permissions');
    }

    const defaultPerms = this.getDefaultPermissions(user.role);

    // Try both string and ObjectId for the query
    const userObjectId = new Types.ObjectId(userId);

    let permission = await this.permissionModel.findOne({
      $or: [
        { userId: userId },
        { userId: userObjectId }
      ]
    });

    if (permission) {
      permission.permissions = defaultPerms as PermissionSet;
      permission.lastModifiedBy = new Types.ObjectId(modifiedBy);
      await permission.save();
    } else {
      permission = await this.permissionModel.create({
        userId: userObjectId,
        permissions: defaultPerms,
        lastModifiedBy: new Types.ObjectId(modifiedBy),
      });
    }

    return permission;
  }

  async createDefaultPermissions(userId: string, role: Role): Promise<void> {
    // Don't create permissions for regular users or super admins
    if (role === Role.USER || role === Role.SUPER_ADMIN) {
      return;
    }

    const userObjectId = new Types.ObjectId(userId);
    const existing = await this.permissionModel.findOne({
      $or: [
        { userId: userId },
        { userId: userObjectId }
      ]
    });
    if (!existing) {
      const defaultPerms = this.getDefaultPermissions(role);
      await this.permissionModel.create({
        userId: userObjectId,
        permissions: defaultPerms,
      });
    }
  }

  async hasPermission(
    userId: string,
    permission: keyof PermissionSet,
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      return false;
    }

    // Super admin always has permission
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Regular users never have admin permissions
    if (user.role === Role.USER) {
      return false;
    }

    const permissions = await this.findUserPermissions(userId);
    return permissions[permission] === true;
  }

  private getDefaultPermissions(role: Role): PermissionSet {
    const basePermissions: PermissionSet = {
      dashboard: false,
      users: false,
      subscriptions: false,
      payments: false,
      meetings: false,
      events: false,
      content: false,
      courses: false,
      announcements: false,
      analytics: false,
      transactions: false,
      reports: false,
      settings: false,
      auditLogs: false,
      permissions: false,
      contactMessages: false,
      modulePermissions: false,
    };

    switch (role) {
      case Role.SUPER_ADMIN:
        return { ...basePermissions, ...DEFAULT_SUPER_ADMIN_PERMISSIONS };
      case Role.ADMIN:
        return { ...basePermissions, ...DEFAULT_ADMIN_PERMISSIONS };
      default:
        return basePermissions;
    }
  }
  
  // Helper method to ensure all permission keys are present
  private ensureAllPermissionKeys(permissions: any): PermissionSet {
    const fullPermissions: PermissionSet = {
      dashboard: false,
      users: false,
      subscriptions: false,
      payments: false,
      meetings: false,
      events: false,
      content: false,
      courses: false,
      announcements: false,
      analytics: false,
      transactions: false,
      reports: false,
      settings: false,
      auditLogs: false,
      permissions: false,
      contactMessages: false,
      modulePermissions: false,
    };
    
    // Merge provided permissions
    if (permissions) {
      Object.keys(fullPermissions).forEach(key => {
        if (permissions[key] !== undefined) {
          fullPermissions[key as keyof PermissionSet] = permissions[key];
        }
      });
    }
    
    return fullPermissions;
  }
}
