// src/user/user.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserInput } from './user.dto';
import { S3Service } from 'src/aws/s3/s3.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly s3Service: S3Service,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(userId: string): Promise<User | null> {
    return this.userModel.findOne({ _id: userId }).exec();
  }

  async updateUser(
    userId: string,
    updateData: Record<string, any>,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ _id: userId }, updateData, { new: true }) // ✅ Use `_id`
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

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const imageUrl = await this.s3Service.uploadProfileImage(file, userId);
    return this.userModel.findByIdAndUpdate(
      userId,
      { profileImage: imageUrl },
      { new: true },
    );
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    return this.userModel.findOne({ stripeCustomerId: customerId }).exec();
  }

  async saveStripeCustomerId(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { stripeCustomerId }).exec();
  }
}
