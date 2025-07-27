import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingAccessTokensService } from './meeting-access-tokens.service';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { User, UserSchema } from '../users/user.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MeetingCronService } from '../services/meeting-cron.service';
import { MeetingStatusPollingService } from '../services/meeting-status-polling.service';
import { VideoSDKModule } from '../videosdk/videosdk.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ModulePermissionsModule } from '../module-permissions/module-permissions.module';
import { WebSocketsModule } from '../websockets/websockets.module';
import { ZoomWebhooksModule } from '../zoom-webhooks/zoom-webhooks.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    VideoSDKModule,
    SubscriptionsModule,
    ModulePermissionsModule,
    WebSocketsModule,
    ZoomWebhooksModule,
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    MeetingAccessTokensService,
    MeetingCronService,
    MeetingStatusPollingService,
  ],
  exports: [MeetingsService, MeetingAccessTokensService],
})
export class MeetingsModule {}
