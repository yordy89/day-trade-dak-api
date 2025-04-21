import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  UseGuards,
  Put,
  Req,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/user.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() data: CreateUserDto) {
    return this.authService.signup(data);
  }

  @Post('login')
  async login(@Body() data: { email: string; password: string }) {
    const user = await this.authService.validateUser(data.email, data.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('password-recovery')
  async passwordRecovery(@Body('email') email: string) {
    const token = this.authService.generateRecoveryToken(email);
    return { message: 'Recovery email sent', token };
  }

  @Get('signout')
  async signout() {
    return { message: 'Signout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-password')
  async updatePassword(
    @Req() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.updatePassword(
      req.user._id,
      body.newPassword,
      body.currentPassword,
    );
    return { message: 'Password updated successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/users/:userId/reset-password')
  async adminResetPassword(
    @Param('userId') userId: string,
    @Body() body: { newPassword: string },
  ) {
    await this.authService.updatePassword(
      userId,
      body.newPassword,
      undefined,
      true,
    );
    return { message: 'Password reset successfully' };
  }
}
