import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as express from 'express';
import { json, raw, urlencoded } from 'body-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/winston.config';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { CustomLoggerService } from './logger/logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Immediate startup logging for ECS debugging
  console.log('[BOOTSTRAP] Application starting...');
  console.log(`[BOOTSTRAP] Node version: ${process.version}`);
  console.log(`[BOOTSTRAP] Platform: ${process.platform}, Arch: ${process.arch}`);
  console.log(`[BOOTSTRAP] PID: ${process.pid}`);
  console.log(`[BOOTSTRAP] Working directory: ${process.cwd()}`);
  console.log(`[BOOTSTRAP] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

  // Load environment variables
  dotenv.config({ path: '.env' });
  console.log('[BOOTSTRAP] Environment variables loaded');

  // Validate critical environment variables
  const requiredEnvVars = [
    'MONGO_URI',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET_NAME',
  ];

  console.log('[BOOTSTRAP] Checking required environment variables...');
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(
        `FATAL: ${envVar} is not defined in the environment variables`,
      );
      process.exit(1);
    }
    console.log(`[BOOTSTRAP] ✓ ${envVar} is set`);
  }

  // Create the NestJS application with Winston logger
  console.log('[BOOTSTRAP] Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  console.log('[BOOTSTRAP] NestJS application created successfully');

  // Get custom logger service
  const customLogger = app.get(CustomLoggerService);

  // Apply security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
    }),
  );

  // Enable compression
  app.use(compression());

  // Set global prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ✅ Middleware for raw body (Stripe Webhooks)
  app.use(
    '/api/v1/payments/webhook',
    raw({ type: 'application/json' }),
    (req: express.Request, _res, next) => {
      (req as any).rawBody = req.body;
      next();
    },
  );

  // ✅ Body parsing for all other routes with size limits
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Enable CORS with specific configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Api-Key',
    ],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 86400, // 24 hours
  });

  // Apply global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: 422,
      validationError: {
        target: false, // Don't expose the object being validated
        value: false, // Don't expose the invalid value
      },
    }),
  );

  // Apply global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Apply global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(customLogger));

  // Setup Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DayTradeDak API')
      .setDescription('Trading academy and CRM API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('payments', 'Payment processing')
      .addTag('videos', 'Video content management')
      .addTag('trading', 'Trading operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Health check endpoint
  app.use('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      memory: process.memoryUsage(),
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    customLogger.error('Uncaught Exception', error.stack, 'Bootstrap');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    customLogger.error('Unhandled Rejection', reason as string, 'Bootstrap');
    customLogger.error(`Promise: ${promise}`, undefined, 'Bootstrap');
  });

  // Start the application
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  customLogger.log(
    `🚀 Server is running on http://${host}:${port}`,
    'Bootstrap',
  );
  customLogger.log(
    `📚 API Documentation: http://${host}:${port}/api/docs`,
    'Bootstrap',
  );
  customLogger.log(
    `🏥 Health Check: http://${host}:${port}/health`,
    'Bootstrap',
  );
  customLogger.log(
    `🌍 Environment: ${process.env.NODE_ENV || 'development'}`,
    'Bootstrap',
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
