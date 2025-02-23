import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/user.dto';

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
}
