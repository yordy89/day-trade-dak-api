import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'yourSecretKey',
    });
  }

  async validate(payload: any) {
    // Check if user exists and is not banned
    const user = await this.userModel.findById(payload.sub).select('status email role');
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    if (user.status === 'banned' || user.status === 'suspended') {
      throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
    }
    
    return { userId: payload.sub, username: payload.username, _id: payload.sub };
  }
}
