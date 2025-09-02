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
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminService } from '../admin.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';

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
  @ApiOperation({
    summary: 'Get admin and super-admin users who can host meetings',
  })
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


  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @Roles(Role.SUPER_ADMIN) // Only super admins can create users
  async createUser(
    @Body() createUserDto: CreateAdminUserDto,
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
    const updatedUser = await this.adminUsersService.updateUser(
      userId,
      updateUserDto,
    );

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
    const updatedUser = await this.adminUsersService.updateUserStatus(
      userId,
      status,
    );

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
  @ApiOperation({ summary: 'Export users to CSV, JSON, or PDF' })
  @ApiQuery({
    name: 'format',
    required: false,
    type: String,
    enum: ['csv', 'json', 'pdf'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'subscription', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  async exportUsers(
    @Query('format') format: 'csv' | 'json' | 'pdf' = 'csv',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('subscription') subscription?: string,
    @Query('role') role?: string,
    @Request() req?: RequestWithUser,
    @Res() res?: Response,
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

    const result = await this.adminUsersService.exportUsers({
      format,
      search,
      status,
      subscription,
      role,
    });

    // Handle different format responses
    if (format === 'json') {
      return res.json(result);
    }

    // For CSV and PDF, result has filename and content properties
    const fileResult = result as { filename: string; content: string | Buffer; contentType: string };

    // For CSV and PDF, set appropriate headers for file download
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
      return res.send(fileResult.content);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
      return res.send(fileResult.content);
    }

    // Default to CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
    return res.send(fileResult.content);
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

  // Subscription management endpoints
  @Post(':userId/subscriptions')
  @ApiOperation({ summary: 'Add subscription to user' })
  async addUserSubscription(
    @Param('userId') userId: string,
    @Body() subscriptionData: { plan: string; expiresAt?: string },
    @Request() req: RequestWithUser,
  ) {
    const result = await this.adminUsersService.addUserSubscription(
      userId,
      subscriptionData,
    );

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'add_subscription',
      resource: 'user_subscription',
      resourceId: userId,
      newValue: subscriptionData,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Patch(':userId/subscriptions/:subscriptionId')
  @ApiOperation({ summary: 'Update user subscription' })
  async updateUserSubscription(
    @Param('userId') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateData: { plan?: string; expiresAt?: string },
    @Request() req: RequestWithUser,
  ) {
    const result = await this.adminUsersService.updateUserSubscription(
      userId,
      subscriptionId,
      updateData,
    );

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'update_subscription',
      resource: 'user_subscription',
      resourceId: subscriptionId,
      newValue: updateData,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post(':userId/subscriptions/:subscriptionId/cancel')
  @ApiOperation({ summary: 'Cancel user subscription' })
  async cancelUserSubscription(
    @Param('userId') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.adminUsersService.cancelUserSubscription(
      userId,
      subscriptionId,
    );

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'cancel_subscription',
      resource: 'user_subscription',
      resourceId: subscriptionId,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Delete(':userId/subscriptions/:subscriptionId')
  @ApiOperation({ summary: 'Delete user subscription' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserSubscription(
    @Param('userId') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.adminUsersService.deleteUserSubscription(userId, subscriptionId);

    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user?.userId || req.user?._id || 'unknown',
      adminEmail: req.user?.email || 'unknown',
      action: 'delete_subscription',
      resource: 'user_subscription',
      resourceId: subscriptionId,
      ipAddress: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'],
    });
  }
}
