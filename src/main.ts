import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as express from 'express';
import { json, raw, urlencoded } from 'body-parser';

async function bootstrap() {
  // Load environment variables
  dotenv.config({ path: '.env' });

  // Ensure MongoDB URI is set
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in the environment variables');
  }

  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // ✅ Middleware to store raw body for Stripe Webhooks
  app.use(
    '/payments/webhook',
    raw({ type: 'application/json' }),
    (req: express.Request, _res, next) => {
      (req as any).rawBody = req.body; // ✅ Store raw body manually
      next();
    },
  );

  // ✅ Keep JSON parsing for all other routes
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Apply global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Start the application
  const port = process.env.PORT || 4000;
  console.log(`🚀 Server is running on http://localhost:${port}`);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
