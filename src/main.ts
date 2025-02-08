import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

async function bootstrap() {
  // Load environment variables from .env file
  dotenv.config({ path: '.env' });

  // Ensure MongoDB URI is set
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in the environment variables');
  }

  // Log environment variables for debugging (remove in production)
  console.log('MongoDB URI:', process.env.MONGO_URI);
  console.log('JWT Secret:', process.env.JWT_SECRET);

  // Create the application
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend/backend communication
  app.enableCors();

  // Apply global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties from DTOs
      forbidNonWhitelisted: true, // Throw an error if unknown properties are present
      transform: true, // Automatically transform payloads to match DTO types
    }),
  );

  // Start the application
  const port = process.env.PORT || 3000;
  console.log(`Server is running on http://localhost:${port}`);
  await app.listen(port);
}

bootstrap();
