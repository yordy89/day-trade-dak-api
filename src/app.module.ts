import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule accessible globally
    }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
