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
import { Public } from 'src/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() data: CreateUserDto) {
    return this.authService.signup(data);
  }

  @Public()
  @Post('login')
  async login(@Body() data: { email: string; password: string }) {
    try {
      const user = await this.authService.validateUser(data.email, data.password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.authService.login(user);
    } catch (error) {
      // Re-throw the error to preserve specific ban messages
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Public()
  @Post('reset-password')
  async requestPasswordReset(@Body('email') email: string) {
    await this.authService.requestPasswordReset(email);
    return { message: 'If an account exists with this email, you will receive password reset instructions.' };
  }

  @Public()
  @Post('reset-password/verify')
  async verifyResetToken(@Body('token') token: string) {
    const isValid = await this.authService.verifyResetToken(token);
    return { valid: isValid };
  }

  @Public()
  @Post('reset-password/update')
  async resetPasswordWithToken(
    @Body() body: { token: string; newPassword: string }
  ) {
    await this.authService.resetPasswordWithToken(body.token, body.newPassword);
    return { message: 'Password has been reset successfully.' };
  }

  @Public()
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
