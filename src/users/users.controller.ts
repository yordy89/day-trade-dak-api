import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './users.service';
import { RequestWithUser } from 'src/auth/auth.interfaces';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

    const { _id, password, ...userWithoutSensitiveData } = user.toObject
      ? user.toObject()
      : user;

    return userWithoutSensitiveData;
  }

  @Post(':userId/upload-profile-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadProfileImage(userId, file);
  }
}
