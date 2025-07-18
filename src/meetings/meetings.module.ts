import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { User, UserSchema } from '../users/user.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MeetingCronService } from '../services/meeting-cron.service';
import { MeetingStatusPollingService } from '../services/meeting-status-polling.service';
import { VideoSDKModule } from '../videosdk/videosdk.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    UsersModule,
    VideoSDKModule,
    SubscriptionsModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingCronService, MeetingStatusPollingService],
  exports: [MeetingsService],
})
export class MeetingsModule {}