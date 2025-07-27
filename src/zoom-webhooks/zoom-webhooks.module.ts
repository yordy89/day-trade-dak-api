import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ZoomWebhooksController } from './zoom-webhooks.controller';
import { ZoomWebhooksService } from './zoom-webhooks.service';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { User, UserSchema } from '../users/user.schema';
import { VideoSDKModule } from '../videosdk/videosdk.module';
import { WebSocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ConfigModule,
    VideoSDKModule,
    WebSocketsModule,
  ],
  controllers: [ZoomWebhooksController],
  providers: [ZoomWebhooksService],
  exports: [ZoomWebhooksService],
})
export class ZoomWebhooksModule {}