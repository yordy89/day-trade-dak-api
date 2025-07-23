import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Role } from '../constants';
import { ModulePermissionsService } from './module-permissions.service';
import { CreateModulePermissionDto } from './dto/create-module-permission.dto';
import { UpdateModulePermissionDto } from './dto/update-module-permission.dto';
import { ModuleType } from './module-permission.schema';
import { RequestWithUser } from '../types/request-with-user.interface';

@ApiTags('Module Permissions')
@Controller('admin/module-permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModulePermissionsController {
  constructor(
    private readonly modulePermissionsService: ModulePermissionsService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Grant module permission to a user' })
  @ApiResponse({ status: 201, description: 'Permission granted successfully' })
  @ApiResponse({ status: 409, description: 'Permission already exists' })
  async create(
    @Body() createDto: CreateModulePermissionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.modulePermissionsService.create(
      createDto,
      req.user._id.toString(),
    );
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all module permissions for a user' })
  @ApiResponse({ status: 200, description: 'List of user module permissions' })
  async getUserPermissions(@Param('userId') userId: string) {
    return this.modulePermissionsService.findAllForUser(userId);
  }

  @Get('module/:moduleType')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users with access to a module' })
  @ApiResponse({ status: 200, description: 'List of users with module access' })
  async getModuleUsers(@Param('moduleType') moduleType: ModuleType) {
    return this.modulePermissionsService.getUsersWithModuleAccess(moduleType);
  }

  @Get('check/:userId/:moduleType')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check if user has access to a module' })
  @ApiResponse({ status: 200, description: 'Access status' })
  async checkAccess(
    @Param('userId') userId: string,
    @Param('moduleType') moduleType: ModuleType,
  ) {
    const hasAccess = await this.modulePermissionsService.hasModuleAccess(
      userId,
      moduleType,
    );
    return { hasAccess, userId, moduleType };
  }

  @Put(':userId/:moduleType')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update module permission' })
  @ApiResponse({ status: 200, description: 'Permission updated successfully' })
  async update(
    @Param('userId') userId: string,
    @Param('moduleType') moduleType: ModuleType,
    @Body() updateDto: UpdateModulePermissionDto,
  ) {
    return this.modulePermissionsService.update(userId, moduleType, updateDto);
  }

  @Delete(':userId/:moduleType')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke module permission' })
  @ApiResponse({ status: 200, description: 'Permission revoked successfully' })
  async revoke(
    @Param('userId') userId: string,
    @Param('moduleType') moduleType: ModuleType,
    @Req() req: RequestWithUser,
  ) {
    await this.modulePermissionsService.revoke(
      userId,
      moduleType,
      req.user._id.toString(),
    );
    return { message: 'Permission revoked successfully' };
  }

  @Post('bulk-grant')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Grant module access to multiple users' })
  @ApiResponse({ status: 200, description: 'Bulk grant completed' })
  async bulkGrant(
    @Body() body: {
      userIds: string[];
      moduleType: ModuleType;
      expiresAt?: string;
      reason?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.modulePermissionsService.bulkGrant(
      body.userIds,
      body.moduleType,
      {
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        reason: body.reason,
        grantedBy: req.user._id.toString(),
      },
    );
  }

  @Post('expire')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger permission expiration check' })
  @ApiResponse({ status: 200, description: 'Expiration check completed' })
  async expirePermissions() {
    const count = await this.modulePermissionsService.expirePermissions();
    return { 
      message: `Expired ${count} permissions`,
      expiredCount: count,
    };
  }
}