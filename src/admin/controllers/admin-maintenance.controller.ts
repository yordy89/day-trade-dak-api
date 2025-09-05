import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Logger,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminMaintenanceService } from '../services/admin-maintenance.service';
import { AdminService } from '../admin.service';

@ApiTags('admin-maintenance')
@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminMaintenanceController {
  private readonly logger = new Logger(AdminMaintenanceController.name);

  constructor(
    private readonly adminMaintenanceService: AdminMaintenanceService,
    private readonly adminService: AdminService,
  ) {}

  @Post('cleanup/expired-subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Manually cleanup expired subscriptions',
    description: 'Removes all expired subscriptions from users. This is the same process that runs automatically at midnight.'
  })
  @ApiResponse({
    status: 200,
    description: 'Expired subscriptions cleaned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        stats: {
          type: 'object',
          properties: {
            usersChecked: { type: 'number' },
            usersUpdated: { type: 'number' },
            subscriptionsRemoved: { type: 'number' },
            executionTime: { type: 'string' },
          },
        },
      },
    },
  })
  async cleanupExpiredSubscriptions(@Request() req: RequestWithUser) {
    const startTime = Date.now();
    
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'execute',
      resource: 'cleanup_expired_subscriptions',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { manual: true },
    });

    this.logger.log(`Manual cleanup initiated by admin: ${req.user.email}`);

    try {
      const result = await this.adminMaintenanceService.cleanupExpiredSubscriptions();
      
      const executionTime = `${(Date.now() - startTime) / 1000}s`;
      
      this.logger.log(
        `Cleanup completed - Users: ${result.usersChecked}, Updated: ${result.usersUpdated}, Removed: ${result.subscriptionsRemoved}`,
      );

      return {
        success: true,
        message: 'Expired subscriptions cleaned successfully',
        stats: {
          ...result,
          executionTime,
        },
      };
    } catch (error) {
      this.logger.error('Failed to cleanup expired subscriptions', error);
      throw error;
    }
  }

  @Get('cleanup/expired-subscriptions/preview')
  @ApiOperation({ 
    summary: 'Preview expired subscriptions',
    description: 'Shows which subscriptions would be removed without actually removing them'
  })
  @ApiResponse({
    status: 200,
    description: 'Preview of expired subscriptions',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        expiredSubscriptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              userEmail: { type: 'string' },
              subscription: {
                type: 'object',
                properties: {
                  plan: { type: 'string' },
                  expiresAt: { type: 'string' },
                  currentPeriodEnd: { type: 'string' },
                  daysExpired: { type: 'number' },
                },
              },
            },
          },
        },
        totalCount: { type: 'number' },
      },
    },
  })
  async previewExpiredSubscriptions(@Request() req: RequestWithUser) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'view',
      resource: 'expired_subscriptions_preview',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const result = await this.adminMaintenanceService.getExpiredSubscriptions();

    return {
      success: true,
      expiredSubscriptions: result.expiredSubscriptions,
      totalCount: result.totalCount,
      usersAffected: result.usersAffected,
    };
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get maintenance status',
    description: 'Shows the current status of maintenance tasks and when they last ran'
  })
  @ApiResponse({
    status: 200,
    description: 'Maintenance status retrieved successfully',
  })
  async getMaintenanceStatus(@Request() req: RequestWithUser) {
    const status = await this.adminMaintenanceService.getMaintenanceStatus();
    
    return {
      success: true,
      status,
    };
  }

  @Post('run-all-tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Run all maintenance tasks',
    description: 'Runs all maintenance tasks including expired subscriptions, failed payments, etc.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: { type: 'string' },
          example: ['expired_subscriptions', 'failed_payments', 'module_permissions'],
        },
      },
    },
  })
  async runAllMaintenanceTasks(
    @Request() req: RequestWithUser,
    @Body('tasks') tasks?: string[],
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'execute',
      resource: 'run_all_maintenance_tasks',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { tasks },
    });

    const results = await this.adminMaintenanceService.runMaintenanceTasks(tasks);

    return {
      success: true,
      message: 'Maintenance tasks completed',
      results,
    };
  }

  @Post('cleanup/single-subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cleanup single expired subscription',
    description: 'Removes a specific expired subscription from a user account'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        plan: { type: 'string', description: 'Subscription plan to remove' },
      },
      required: ['userId', 'plan'],
    },
  })
  async cleanupSingleSubscription(
    @Request() req: RequestWithUser,
    @Body('userId') userId: string,
    @Body('plan') plan: string,
  ) {
    // Log admin action
    await this.adminService.logAdminAction({
      adminId: req.user.userId,
      adminEmail: req.user.email,
      action: 'execute',
      resource: 'cleanup_single_subscription',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { userId, plan },
    });

    this.logger.log(`Single subscription cleanup initiated by admin: ${req.user.email} for user: ${userId}, plan: ${plan}`);

    try {
      const result = await this.adminMaintenanceService.cleanupSingleSubscription(userId, plan);
      
      return {
        success: true,
        message: `Successfully removed ${plan} subscription for user`,
        result,
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup single subscription for user ${userId}`, error);
      throw error;
    }
  }
}