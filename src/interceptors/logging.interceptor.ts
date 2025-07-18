import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private customLogger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Generate or get correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set correlation ID in request and response
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);

    // Log request
    const requestLog = {
      correlationId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).user?.id,
      body: this.sanitizeBody(request.body),
      query: request.query,
      params: request.params,
    };

    this.customLogger.log(
      `Incoming Request: ${request.method} ${request.url}`,
      'HTTP',
    );
    this.customLogger.debug(JSON.stringify(requestLog), 'HTTP Request Details');

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - now;

        // Log response
        const responseLog = {
          correlationId,
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          responseTime: `${responseTime}ms`,
          userId: (request as any).user?.id,
        };

        this.customLogger.log(
          `Outgoing Response: ${request.method} ${request.url} - ${response.statusCode} - ${responseTime}ms`,
          'HTTP',
        );
        this.customLogger.debug(
          JSON.stringify(responseLog),
          'HTTP Response Details',
        );

        // Log slow requests
        if (responseTime > 1000) {
          this.customLogger.warn(
            `Slow Request Detected: ${request.method} ${request.url} took ${responseTime}ms`,
            'Performance',
          );
        }

        // Log performance metric
        this.customLogger.logPerformanceMetric(
          `http_request_${request.method.toLowerCase()}_${request.route?.path || 'unknown'}`,
          responseTime,
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - now;

        // Log error
        this.customLogger.error(
          `Request Failed: ${request.method} ${request.url} - ${error.status || 500} - ${responseTime}ms`,
          error.stack,
          'HTTP',
        );

        // Re-throw the error
        throw error;
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'authorization',
      'api_key',
      'apiKey',
      'credit_card',
      'creditCard',
      'ssn',
    ];

    const sanitized = { ...body };

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (
        typeof sanitized[key] === 'object' &&
        sanitized[key] !== null
      ) {
        sanitized[key] = this.sanitizeBody(sanitized[key]);
      }
    });

    return sanitized;
  }
}
