import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Role } from '../constants';
import { PermissionsService } from './permissions.service';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { RequestWithUser } from '../types/request-with-user.interface';

@ApiTags('Admin Permissions')
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all admin users with their permissions' })
  @ApiResponse({
    status: 200,
    description: 'List of admin users with permissions',
  })
  async getAllAdminPermissions(@Req() req: RequestWithUser) {
    return this.permissionsService.findAllAdminUsers();
  }

  @Get(':userId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Both admin and super admin can access
  @ApiOperation({ summary: 'Get user permissions' })
  @ApiResponse({ status: 200, description: 'User permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserPermissions(
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    // Allow admins to view their own permissions
    if (req.user.role === Role.ADMIN && req.user._id.toString() !== userId) {
      throw new ForbiddenException('You can only view your own permissions');
    }

    const permissions =
      await this.permissionsService.findUserPermissions(userId);
    return { userId, permissions };
  }

  @Put(':userId')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user permissions' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot modify permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserPermissions(
    @Param('userId') userId: string,
    @Body() updateDto: UpdatePermissionDto,
    @Req() req: RequestWithUser,
  ) {
    // Debug logging
    console.log('Updating permissions for user:', userId);
    console.log('Received permissions data:', JSON.stringify(updateDto, null, 2));
    
    const result = await this.permissionsService.updateUserPermissions(
      userId,
      updateDto,
      req.user._id.toString(),
    );

    console.log('Updated permissions result:', JSON.stringify(result.permissions, null, 2));

    return {
      message: 'Permissions updated successfully',
      permissions: result.permissions,
    };
  }

  @Post(':userId/reset')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reset user permissions to default' })
  @ApiResponse({ status: 200, description: 'Permissions reset successfully' })
  @ApiResponse({ status: 403, description: 'Cannot reset permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetUserPermissions(
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    const result = await this.permissionsService.resetUserPermissions(
      userId,
      req.user._id.toString(),
    );

    return {
      message: 'Permissions reset to default successfully',
      permissions: result.permissions,
    };
  }
}
