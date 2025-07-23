import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { AdminSubscriptionsService } from '../services/admin-subscriptions.service';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { AdminService } from '../admin.service';
import { Response } from 'express';

interface SubscriptionFiltersDto {
  page?: string;
  limit?: string;
  search?: string;
  planId?: string;
  status?: 'active' | 'expired' | 'cancelled';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UpdateSubscriptionDto {
  expiresAt?: Date;
  status?: string;
}

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSubscriptionsController {
  constructor(
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async getSubscriptions(
    @Query() filters: SubscriptionFiltersDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.findAllWithFilters(filters);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_SUBSCRIPTIONS',
        resource: 'subscriptions',
        details: { filters },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return result;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw new BadRequestException(`Failed to fetch subscriptions: ${error.message}`);
    }
  }

  @Get('test')
  async testSubscriptions(@Req() req: RequestWithUser) {
    try {
      const users = await this.adminSubscriptionsService.testSubscriptionData();
      return users;
    } catch (error) {
      console.error('Error in test:', error);
      throw new BadRequestException(`Test failed: ${error.message}`);
    }
  }

  @Get('stats')
  async getSubscriptionStats(@Req() req: RequestWithUser) {
    try {
      const stats = await this.adminSubscriptionsService.getSubscriptionStatistics();
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_SUBSCRIPTION_STATS',
        resource: 'subscriptions',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return stats;
    } catch (error) {
      throw new BadRequestException('Failed to fetch subscription statistics');
    }
  }

  @Get('plans')
  async getSubscriptionPlans(@Req() req: RequestWithUser) {
    try {
      const plans = await this.adminSubscriptionsService.getSubscriptionPlans();
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_SUBSCRIPTION_PLANS',
        resource: 'subscriptions',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return plans;
    } catch (error) {
      throw new BadRequestException('Failed to fetch subscription plans');
    }
  }

  @Get('user/:userId')
  async getUserSubscriptions(
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const subscriptions = await this.adminSubscriptionsService.getUserSubscriptions(userId);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'VIEW_USER_SUBSCRIPTIONS',
        resource: 'subscriptions',
        resourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return subscriptions;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user subscriptions');
    }
  }

  @Put(':subscriptionId')
  async updateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateDto: UpdateSubscriptionDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.updateSubscription(
        subscriptionId,
        updateDto,
      );
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'UPDATE_SUBSCRIPTION',
        resource: 'subscriptions',
        resourceId: subscriptionId,
        newValue: updateDto,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Subscription updated successfully',
        subscription: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update subscription');
    }
  }

  @Post(':subscriptionId/cancel')
  async cancelSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.cancelSubscription(subscriptionId);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'CANCEL_SUBSCRIPTION',
        resource: 'subscriptions',
        resourceId: subscriptionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Subscription cancelled successfully',
        subscription: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  @Post(':subscriptionId/reactivate')
  async reactivateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.reactivateSubscription(subscriptionId);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'REACTIVATE_SUBSCRIPTION',
        resource: 'subscriptions',
        resourceId: subscriptionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Subscription reactivated successfully',
        subscription: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to reactivate subscription');
    }
  }

  @Post('plans')
  async createSubscriptionPlan(
    @Body() planData: any,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.createSubscriptionPlan(planData);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'CREATE_SUBSCRIPTION_PLAN',
        resource: 'subscription_plans',
        newValue: planData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Subscription plan created successfully',
        plan: result,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create subscription plan: ${error.message}`);
    }
  }

  @Put('plans/:planId')
  async updateSubscriptionPlan(
    @Param('planId') planId: string,
    @Body() planData: any,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminSubscriptionsService.updateSubscriptionPlan(planId, planData);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'UPDATE_SUBSCRIPTION_PLAN',
        resource: 'subscription_plans',
        resourceId: planId,
        newValue: planData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      return {
        message: 'Subscription plan updated successfully',
        plan: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update subscription plan: ${error.message}`);
    }
  }

  @Get('export')
  async exportSubscriptions(
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'excel',
    @Query() filters: SubscriptionFiltersDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const { buffer, filename, contentType } = await this.adminSubscriptionsService.exportSubscriptions(format, filters);
      
      // Log admin action
      await this.adminService.logAdminAction({
        adminId: req.user._id.toString(),
        adminEmail: req.user.email,
        action: 'EXPORT_SUBSCRIPTIONS',
        resource: 'subscriptions',
        details: { format, filters },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
      });

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      });

      res.send(buffer);
    } catch (error) {
      throw new BadRequestException(`Failed to export subscriptions: ${error.message}`);
    }
  }
}