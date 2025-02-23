import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UserController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from 'src/aws/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => AuthModule),
    S3Module,
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UsersModule {}
