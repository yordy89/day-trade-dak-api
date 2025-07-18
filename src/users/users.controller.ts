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
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Delete('/admin/:userId')
  async deleteUserFromAdmin(@Param('userId') userId: string) {
    return this.userService.deleteUserFromAdmin(userId);
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
}
