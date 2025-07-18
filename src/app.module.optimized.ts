import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Core Modules
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { CacheModule } from './cache/cache.module';

// Feature Modules
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
import { CronModule } from './cron/cron.module';
import { VideoModule } from './video/video.module';
import { EmailModule } from './email/email.module';
import { FinnhubModule } from './services/finnhub/finnhub.module';

// Filters, Guards, and Interceptors
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RateLimitGuard } from './guards/rate-limit.guard';

// Services
import { CustomLoggerService } from './logger/logger.service';
import { PerformanceMonitoringService } from './monitoring/performance.service';

// Configuration
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
      expandVariables: true,
    }),

    // Throttler Module for basic rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60),
          limit: config.get('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // Schedule Module
    ScheduleModule.forRoot(),

    // Core Infrastructure Modules
    LoggerModule,
    CacheModule,
    DatabaseModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    TradeModule,
    MissionModule,
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
  ],
  providers: [
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global Logging Interceptor
    {
      provide: APP_INTERCEPTOR,
      inject: [CustomLoggerService],
      useFactory: (logger: CustomLoggerService) =>
        new LoggingInterceptor(logger),
    },
    // Global Rate Limit Guard (in addition to endpoint-specific limits)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Custom Rate Limit Guard for specific endpoints
    RateLimitGuard,
    // Performance Monitoring Service
    PerformanceMonitoringService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // You can add custom middleware here if needed
    // For example, correlation ID middleware, request context, etc.
  }

  constructor(
    private logger: CustomLoggerService,
    private performanceService: PerformanceMonitoringService,
  ) {
    this.logger.log('Application module initialized', 'AppModule');

    // Log initial performance metrics
    const metrics = this.performanceService.getMetrics();
    this.logger.log(
      `Initial memory usage: ${(metrics.process.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      'AppModule',
    );
  }
}
