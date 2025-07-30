import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminMeetingsController } from './controllers/admin-meetings.controller';
import { AdminEventsController } from './controllers/admin-events.controller';
import { AdminSubscriptionsController } from './controllers/admin-subscriptions.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminContactController } from './controllers/admin-contact.controller';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminTransactionsController } from './controllers/admin-transactions.controller';
import { AdminService } from './admin.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminMeetingsService } from './services/admin-meetings.service';
import { AdminEventsService } from './services/admin-events.service';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminTransactionsService } from './services/admin-transactions.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { VideoSDKModule } from '../videosdk/videosdk.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminLog, AdminLogSchema } from './schemas/admin-log.schema';
import { User, UserSchema } from '../users/user.schema';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { Event, EventSchema } from '../event/schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from '../event/schemas/eventRegistration.schema';
import { MeetingCronService } from '../services/meeting-cron.service';
import {
  Transaction,
  TransactionSchema,
} from '../payments/stripe/transaction.schema';
import {
  SubscriptionHistory,
  SubscriptionHistorySchema,
} from '../payments/stripe/subscription-history.schema';
import { PaymentAnalyticsService } from '../payments/stripe/payment-analytics.service';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from '../subscriptions/subscription-plan.schema';
import { PermissionsModule } from '../permissions/permissions.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { SettingsModule } from '../settings/settings.module';
import { ContactModule } from '../contact/contact.module';
import { NotificationModule } from '../notification/notification.module';
import { StripeModule } from '../payments/stripe/stripe.module';
import {
  ContactMessage,
  ContactMessageSchema,
} from '../contact/contact-message.schema';

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
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: ContactMessage.name, schema: ContactMessageSchema },
    ]),
    UsersModule,
    AuthModule,
    VideoSDKModule,
    PermissionsModule,
    LiveKitModule,
    SettingsModule,
    ContactModule,
    NotificationModule,
    StripeModule,
  ],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminAnalyticsController,
    AdminMeetingsController,
    AdminEventsController,
    AdminSubscriptionsController,
    AdminSettingsController,
    AdminContactController,
    AdminNotificationsController,
    AdminReportsController,
    AdminTransactionsController,
  ],
  providers: [
    AdminService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminMeetingsService,
    AdminEventsService,
    AdminSubscriptionsService,
    AdminSettingsService,
    AdminReportsService,
    AdminTransactionsService,
    MeetingCronService,
    PaymentAnalyticsService,
  ],
  exports: [
    AdminService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminMeetingsService,
    AdminEventsService,
    AdminSubscriptionsService,
    AdminSettingsService,
    AdminReportsService,
    AdminTransactionsService,
  ],
})
export class AdminModule {}
