import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './users.service';
import { UsersServiceOptimized } from './users.service.optimized';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UserController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from 'src/aws/s3/s3.module';
import { CacheModule } from 'src/cache/cache.module';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => AuthModule),
    S3Module,
    CacheModule,
    LoggerModule,
    ConfigModule,
  ],
  providers: [
    UserService,
    {
      provide: 'UserServiceOptimized',
      useClass: UsersServiceOptimized,
    },
    UsersServiceOptimized,
  ],
  controllers: [UserController],
  exports: [UserService, UsersServiceOptimized],
})
export class UsersModule {}
