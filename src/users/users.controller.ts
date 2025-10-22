import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { UserService } from './users.service';
import { RequestWithUser } from 'src/auth/auth.interfaces';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { Role } from 'src/constants';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers() {
    const users = await this.userService.findAll();
    return users.map((user) => {
      const { password, ...userWithoutSensitiveData } = user.toObject
        ? user.toObject()
        : user;
      return {
        ...userWithoutSensitiveData,
        subscriptions: user.subscriptions.map((sub) => sub.plan),
        activeSubscriptions: user.subscriptions
          .filter((sub) => !sub.expiresAt) // ✅ Only return active subscriptions
          .map((sub) => sub.plan),
        expiredSubscriptions: user.subscriptions
          .filter((sub) => sub.expiresAt) // ✅ Only return expired subscriptions
          .map((sub) => sub.plan),
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: RequestWithUser) {
    const userId = req.user?._id;
    if (!userId) {
      return { message: 'Invalid token' };
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      return { message: 'User not found' };
    }

    const { password, ...userWithoutSensitiveData } = user.toObject
      ? user.toObject()
      : user;

    // Return full subscription objects instead of just plan names
    const now = new Date();
    const subscriptionsWithDetails = user.subscriptions.map((sub) => ({
      plan: sub.plan,
      expiresAt: sub.expiresAt,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      createdAt: sub.createdAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      status: sub.status,
      isActive: !sub.expiresAt || sub.expiresAt > now,
    }));

    return {
      ...userWithoutSensitiveData,
      subscriptions: subscriptionsWithDetails,
      activeSubscriptions: user.subscriptions
        .filter((sub) => !sub.expiresAt || sub.expiresAt > now)
        .map((sub) => sub.plan),
      expiredSubscriptions: user.subscriptions
        .filter((sub) => sub.expiresAt && sub.expiresAt <= now)
        .map((sub) => sub.plan),
    };
  }

  @Post(':userId/upload-profile-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadProfileImage(userId, file);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() body: { first_name?: string; last_name?: string },
  ) {
    const updatedUser = await this.userService.updateUser(req.user._id, body);
    const { password, ...userWithoutSensitiveData } = updatedUser.toObject
      ? updatedUser.toObject()
      : updatedUser;

    return {
      ...userWithoutSensitiveData,
      subscriptions: updatedUser.subscriptions.map((sub) => sub.plan),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('/admin/:userId')
  async deleteUserFromAdmin(@Param('userId') userId: string, @Req() req: RequestWithUser) {
    const adminId = req.user?._id;
    return this.userService.deleteUserFromAdmin(userId, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions/details')
  async getSubscriptionDetails(@Req() req: RequestWithUser) {
    const userId = req.user?._id;
    if (!userId) {
      return { message: 'Invalid token' };
    }

    return this.userService.getSubscriptionDetails(userId);
  }

  // GDPR: Self-service account deletion
  @UseGuards(JwtAuthGuard)
  @Post('request-deletion')
  async requestAccountDeletion(@Req() req: RequestWithUser) {
    const userId = req.user?._id;
    if (!userId) {
      throw new BadRequestException('Invalid token');
    }

    return this.userService.requestAccountDeletion(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-deletion')
  async cancelAccountDeletion(@Req() req: RequestWithUser) {
    const userId = req.user?._id;
    if (!userId) {
      throw new BadRequestException('Invalid token');
    }

    return this.userService.cancelAccountDeletion(userId);
  }

  // GDPR: User data export (Right to Portability)
  @UseGuards(JwtAuthGuard)
  @Get('export-my-data/:format')
  async exportMyData(
    @Req() req: RequestWithUser,
    @Param('format') format: 'json' | 'pdf' | 'excel',
    @Res() res: Response,
  ) {
    const userId = req.user?._id;
    if (!userId) {
      throw new BadRequestException('Invalid token');
    }

    const data = await this.userService.exportUserData(userId, format);
    const timestamp = new Date().toISOString().split('T')[0];
    const userEmail = req.user?.username || 'user';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="daytradedak-data-${userEmail}-${timestamp}.json"`);
      return res.send(JSON.stringify(data, null, 2));
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="daytradedak-data-${userEmail}-${timestamp}.pdf"`);
      return res.send(data);
    } else if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="daytradedak-data-${userEmail}-${timestamp}.xlsx"`);
      return res.send(data);
    }

    return res.status(400).send({ error: 'Invalid format' });
  }
}
