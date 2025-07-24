import { Module } from '@nestjs/common';
import { VideoSDKController } from './videosdk.controller';
import { VideoSDKService } from './videosdk.service';
import { ZoomService } from './zoom.service';
import { ZoomApiService } from './zoom-api.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, UsersModule, AuthModule],
  controllers: [VideoSDKController],
  providers: [VideoSDKService, ZoomService, ZoomApiService],
  exports: [VideoSDKService, ZoomService, ZoomApiService],
})
export class VideoSDKModule {}
