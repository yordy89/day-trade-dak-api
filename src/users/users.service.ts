// src/user/user.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserInput } from './user.dto';
@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(userId: string): Promise<User | null> {
    return this.userModel.findOne({ id: userId }).exec();
  }

  async updateUser(
    userId: string,
    updateData: Partial<any>,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ id: userId }, updateData, { new: true })
      .exec();
  }

  async findByRecoveryToken(recoveryToken: string): Promise<User | null> {
    return this.userModel.findOne({ recoveryToken }).exec();
  }

  async clearRecoveryToken(userId: string): Promise<any> {
    await this.userModel
      .findOneAndUpdate({ id: userId }, { recoveryToken: null })
      .exec();
  }
}
