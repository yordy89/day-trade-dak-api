import { Module } from '@nestjs/common';
import { VideoSDKController } from './videosdk.controller';
import { VideoSDKService } from './videosdk.service';
import { ZoomService } from './zoom.service';
import { ZoomApiService } from './zoom-api.service';
import { ZoomWebSDKController } from './zoom-websdk.controller';
import { ZoomWebSDKService } from './zoom-websdk.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, UsersModule, AuthModule],
  controllers: [VideoSDKController, ZoomWebSDKController],
  providers: [VideoSDKService, ZoomService, ZoomApiService, ZoomWebSDKService],
  exports: [VideoSDKService, ZoomService, ZoomApiService, ZoomWebSDKService],
})
export class VideoSDKModule {}
