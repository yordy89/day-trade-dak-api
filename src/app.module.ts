import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { TradeModule } from './trade/trade.module';
import { MissionModule } from './mission/mission.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AxiosModule } from './axios/axios.module';
import { YahooFinanceModule } from './services/yahoo-finance/yahoo-finance.module';
import { S3Module } from './aws/s3/s3.module';
import { CompanyModule } from './company/company.module';
import { EventModule } from './event/event.module';
import { OpenaiModule } from './services/openai/openai.module';
import { StripeModule } from './payments/stripe/stripe.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { VideoModule } from './video/video.module';
import { EmailModule } from './email/email.module';
import { FinnhubModule } from './services/finnhub/finnhub.module';
import { LoggerModule } from './logger/logger.module';
import { CacheModule } from './cache/cache.module';
import { PerformanceModule } from './performance/performance.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { CustomLoggerService } from './logger/logger.service';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { VideoSDKModule } from './videosdk/videosdk.module';
import { AdminModule } from './admin/admin.module';
import { MeetingsModule } from './meetings/meetings.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WebSocketsModule } from './websockets/websockets.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PermissionsModule } from './permissions/permissions.module';
import { GuardsModule } from './guards/guards.module';
import { ModulePermissionsModule } from './module-permissions/module-permissions.module';
import { ZoomWebhooksModule } from './zoom-webhooks/zoom-webhooks.module';
import { LiveKitModule } from './livekit/livekit.module';
import { SettingsModule } from './settings/settings.module';
import { ContactModule } from './contact/contact.module';
import { NotificationModule } from './notification/notification.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { CDNModule } from './modules/cdn/cdn.module';
import { MarketModule } from './services/market/market.module';
import { ContentModule } from './content/content.module';
import { TestUploadController } from './test-upload.controller';
import { AffiliateModule } from './affiliate/affiliate.module';
import { LocalFinancingModule } from './payments/local-financing/local-financing.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';

@Module({
  controllers: [TestUploadController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('throttle.ttl', 60),
          limit: config.get('throttle.limit', 100),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('redis.host', 'localhost'),
          port: config.get('redis.port', 6379),
          password: config.get('redis.password'),
        },
      }),
    }),
    GuardsModule,
    LoggerModule,
    CacheModule,
    PerformanceModule,
    DatabaseModule,
    TradeModule,
    MissionModule,
    UsersModule,
    AuthModule,
    AxiosModule,
    YahooFinanceModule,
    S3Module,
    CompanyModule,
    EventModule,
    OpenaiModule,
    StripeModule,
    CronModule,
    VideoModule,
    EmailModule,
    FinnhubModule,
    VideoSDKModule,
    AdminModule,
    WebSocketsModule,
    SubscriptionsModule,
    PermissionsModule,
    ModulePermissionsModule,
    MeetingsModule,
    WebhooksModule,
    ZoomWebhooksModule,
    LiveKitModule,
    SettingsModule,
    ContactModule,
    NotificationModule,
    NewsletterModule,
    CDNModule,
    MarketModule,
    ContentModule,
    AffiliateModule,
    LocalFinancingModule,
    EmailMarketingModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: CustomLoggerService) =>
        new LoggingInterceptor(logger),
      inject: [CustomLoggerService],
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
