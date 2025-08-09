import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { plainToInstance } from 'class-transformer';
import { CreateUserInput, UserEntity } from 'src/users/user.dto';
import { UserService } from 'src/users/users.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // Check if user is banned
      if (user.status === 'banned' || user.status === 'suspended') {
        throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
      }
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user._id.toString() };

    const userSubscriptions = user.subscriptions.map((sub) => sub.plan);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...user,
        subscriptions: userSubscriptions,
      },
    };
  }

  async signup(user: CreateUserInput) {
    const userExists = await this.userService.findByEmail(user.email);
    if (userExists) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    const userCreated = await this.userService.createUser({
      ...user,
      password: hashedPassword,
    });

    const plainUser = userCreated.toObject();

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail({
        firstName: userCreated.firstName,
        email: userCreated.email,
      });
    } catch (error) {
      // Log error but don't fail the signup process
      console.error('Failed to send welcome email:', error);
    }

    return plainToInstance(UserEntity, plainUser);
  }

  async generateRecoveryToken(email: string): Promise<string> {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new Error('User not found');
    const token = this.jwtService.sign({ sub: user.id });
    user.recoveryToken = token;
    await user.save();
    return token;
  }
  async updatePassword(
    userId: string,
    newPassword: string,
    oldPassword?: string,
    skipValidation = false,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }

    if (!skipValidation) {
      const passwordMatches = await bcrypt.compare(
        oldPassword || '',
        user.password,
      );
      if (!passwordMatches) {
        throw new BadRequestException('La contraseña actual no coincide');
      }
    }

    if (newPassword.length < 8) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 8 caracteres',
      );
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    
    // Don't reveal if user exists or not for security
    if (!user) {
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save token and expiry to user
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Generate reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password/confirm?token=${resetToken}`;

    // Send email
    try {
      await this.emailService.sendPasswordResetEmail({
        name: user.fullName || user.email.split('@')[0],
        email: user.email,
        resetLink: resetUrl,
        expiresIn: '1 hour',
      });
    } catch (error) {
      // Clear reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      throw new BadRequestException('Failed to send reset email. Please try again.');
    }
  }

  async verifyResetToken(token: string): Promise<boolean> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.userService.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    return !!user;
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.userService.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Update password and clear reset token
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  }
}
