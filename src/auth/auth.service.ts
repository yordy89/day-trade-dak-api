import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { CreateUserInput, UserEntity } from 'src/users/user.dto';
import { UserService } from 'src/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user.toObject();
      console.log(password);
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user._id.toString() };
    return {
      access_token: this.jwtService.sign(payload),
      user,
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
}
