import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminService } from '../admin.service';

@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminService: AdminService,
  ) {}

  @Get('hosts')
  @ApiOperation({ summary: 'Get admin and super-admin users who can host meetings' })
  async getAdminHosts(@Request() req: RequestWithUser) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'view',
      resource: 'admin-hosts',
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminUsersService.getAdminHosts();
  }

  @Get()
  @ApiOperation({ summary: 'Get users with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'subscription', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('subscription') subscription?: string,
    @Query('role') role?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Request() req?: RequestWithUser,
  ) {
    // Debug log
    console.log('Request user:', req.user);
    console.log('User ID:', req.user?.userId || req.user?._id);
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'view',
      resource: 'users',
      details: { page, limit, search, status, subscription, role },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminUsersService.getUsers({
      page: page || 1,
      limit: limit || 25,
      search,
      status,
      subscription,
      role,
      sortBy,
      sortOrder,
    });
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'view',
      resource: 'user',
      resourceId: userId,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminUsersService.getUserById(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @Roles(Role.SUPER_ADMIN) // Only super admins can create users
  async createUser(
    @Body() createUserDto: any,
    @Request() req: RequestWithUser,
  ) {
    const user = await this.adminUsersService.createUser(createUserDto);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'create',
      resource: 'user',
      resourceId: user._id.toString(),
      newValue: { email: user.email, role: user.role },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Update user' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: any,
    @Request() req: RequestWithUser,
  ) {
    const previousUser = await this.adminUsersService.getUserById(userId);
    const updatedUser = await this.adminUsersService.updateUser(userId, updateUserDto);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'update',
      resource: 'user',
      resourceId: userId,
      previousValue: previousUser,
      newValue: updatedUser,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return updatedUser;
  }

  @Patch(':userId/status')
  @ApiOperation({ summary: 'Update user status' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body('status') status: string,
    @Request() req: RequestWithUser,
  ) {
    const previousUser = await this.adminUsersService.getUserById(userId);
    const updatedUser = await this.adminUsersService.updateUserStatus(userId, status);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'update_status',
      resource: 'user',
      resourceId: userId,
      previousValue: { status: previousUser.status },
      newValue: { status: updatedUser.status },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return updatedUser;
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Delete user' })
  @Roles(Role.SUPER_ADMIN) // Only super admins can delete users
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    const user = await this.adminUsersService.getUserById(userId);
    await this.adminUsersService.deleteUser(userId);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'delete',
      resource: 'user',
      resourceId: userId,
      previousValue: { email: user.email, role: user.role },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export users to CSV' })
  @ApiQuery({ name: 'format', required: false, type: String, enum: ['csv', 'json'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'subscription', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  async exportUsers(
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('subscription') subscription?: string,
    @Query('role') role?: string,
    @Request() req?: RequestWithUser,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'export',
      resource: 'users',
      details: { format, search, status, subscription, role },
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return this.adminUsersService.exportUsers({
      format,
      search,
      status,
      subscription,
      role,
    });
  }
}