import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument, PermissionSet, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_SUPER_ADMIN_PERMISSIONS } from './permission.schema';
import { User, UserDocument } from '../users/user.schema';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Role } from '../constants';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name) private permissionModel: Model<PermissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAllAdminUsers() {
    // Get all users with admin or super_admin role
    const adminUsers = await this.userModel.find({
      role: { $in: [Role.ADMIN, Role.SUPER_ADMIN] }
    }).select('_id email firstName lastName role status').lean();

    // Get permissions for all admin users
    const userIds = adminUsers.map(user => user._id);
    const permissions = await this.permissionModel.find({
      userId: { $in: userIds }
    }).lean();

    // Create a map for quick lookup
    const permissionsMap = new Map(
      permissions.map(p => [p.userId.toString(), p.permissions])
    );

    // Combine user data with permissions
    return adminUsers.map(user => ({
      ...user,
      permissions: permissionsMap.get(user._id.toString()) || this.getDefaultPermissions(user.role),
    }));
  }

  async findUserPermissions(userId: string): Promise<PermissionSet> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Super admin always has all permissions
    if (user.role === Role.SUPER_ADMIN) {
      return DEFAULT_SUPER_ADMIN_PERMISSIONS as PermissionSet;
    }

    // Regular users have no admin permissions
    if (user.role === Role.USER) {
      return {} as PermissionSet;
    }

    // Check for existing permissions
    const permission = await this.permissionModel.findOne({ userId }).lean();
    
    if (permission) {
      return permission.permissions;
    }

    // Return default permissions for admin role
    return this.getDefaultPermissions(user.role);
  }

  async updateUserPermissions(
    userId: string, 
    updateDto: UpdatePermissionDto,
    modifiedBy: string
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
      throw new ForbiddenException('Regular users cannot have admin permissions');
    }

    let permission = await this.permissionModel.findOne({ userId });

    if (permission) {
      // Update existing permissions
      Object.assign(permission.permissions, updateDto);
      permission.lastModifiedBy = new Types.ObjectId(modifiedBy);
      await permission.save();
    } else {
      // Create new permission record
      const defaultPerms = this.getDefaultPermissions(user.role);
      permission = await this.permissionModel.create({
        userId,
        permissions: { ...defaultPerms, ...updateDto },
        lastModifiedBy: new Types.ObjectId(modifiedBy),
      });
    }

    return permission;
  }

  async resetUserPermissions(userId: string, modifiedBy: string): Promise<Permission> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot reset super admin permissions');
    }

    const defaultPerms = this.getDefaultPermissions(user.role);
    
    let permission = await this.permissionModel.findOne({ userId });
    
    if (permission) {
      permission.permissions = defaultPerms as PermissionSet;
      permission.lastModifiedBy = new Types.ObjectId(modifiedBy);
      await permission.save();
    } else {
      permission = await this.permissionModel.create({
        userId,
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

    const existing = await this.permissionModel.findOne({ userId });
    if (!existing) {
      const defaultPerms = this.getDefaultPermissions(role);
      await this.permissionModel.create({
        userId,
        permissions: defaultPerms,
      });
    }
  }

  async hasPermission(userId: string, permission: keyof PermissionSet): Promise<boolean> {
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
}