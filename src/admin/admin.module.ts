import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminMeetingsController } from './controllers/admin-meetings.controller';
import { AdminEventsController } from './controllers/admin-events.controller';
import { AdminService } from './admin.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminMeetingsService } from './services/admin-meetings.service';
import { AdminEventsService } from './services/admin-events.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { VideoSDKModule } from '../videosdk/videosdk.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminLog, AdminLogSchema } from './schemas/admin-log.schema';
import { User, UserSchema } from '../users/user.schema';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { Event, EventSchema } from '../event/schemas/event.schema';
import { EventRegistration, EventRegistrationSchema } from '../event/schemas/eventRegistration.schema';
import { MeetingCronService } from '../services/meeting-cron.service';
import { Transaction, TransactionSchema } from '../payments/stripe/transaction.schema';
import { SubscriptionHistory, SubscriptionHistorySchema } from '../payments/stripe/subscription-history.schema';
import { PaymentAnalyticsService } from '../payments/stripe/payment-analytics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminLog.name, schema: AdminLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: SubscriptionHistory.name, schema: SubscriptionHistorySchema },
    ]),
    UsersModule,
    AuthModule,
    VideoSDKModule,
  ],
  controllers: [AdminController, AdminUsersController, AdminAnalyticsController, AdminMeetingsController, AdminEventsController],
  providers: [AdminService, AdminUsersService, AdminAnalyticsService, AdminMeetingsService, AdminEventsService, MeetingCronService, PaymentAnalyticsService],
  exports: [AdminService, AdminUsersService, AdminAnalyticsService, AdminMeetingsService, AdminEventsService],
})
export class AdminModule {}