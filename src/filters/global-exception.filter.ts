import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError } from 'mongodb';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  stack?: string;
  correlationId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate correlation ID for tracking
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof MongoError) {
      // Handle MongoDB specific errors
      status = HttpStatus.BAD_REQUEST;
      error = 'Database Error';

      if (exception.code === 11000) {
        message = 'Duplicate entry detected';
      } else {
        message = 'Database operation failed';
      }

      this.logger.error(`MongoDB Error: ${exception.message}`, exception.stack);
    } else if (exception instanceof Error) {
      // Handle generic errors
      message = exception.message;
      error = exception.name;

      // Log unhandled errors
      this.logger.error(
        `Unhandled Error: ${exception.message}`,
        exception.stack,
      );
    }

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      correlationId,
    };

    // Add error details in development
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.error = error;
      if (exception instanceof Error) {
        errorResponse.stack = exception.stack;
      }
    }

    // Log error with context
    this.logger.error({
      message: `${request.method} ${request.url} - ${status} - ${error}`,
      correlationId,
      userId: (request as any).user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      body: request.body,
      query: request.query,
      params: request.params,
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : exception,
    });

    // Set correlation ID in response headers
    response.setHeader('X-Correlation-Id', correlationId);

    // Send error response
    response.status(status).json(errorResponse);
  }
}
