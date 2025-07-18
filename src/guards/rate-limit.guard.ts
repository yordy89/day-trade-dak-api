import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CustomLoggerService } from '../logger/logger.service';

interface RateLimitOptions {
  ttl: number; // Time window in seconds
  limit: number; // Max requests in time window
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private store = new Map<string, RateLimitStore>();
  private readonly defaultOptions: RateLimitOptions = {
    ttl: 60, // 1 minute
    limit: 100, // 100 requests per minute
  };

  constructor(
    private reflector: Reflector,
    private logger: CustomLoggerService,
  ) {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Get rate limit options from decorator or use defaults
    const options =
      this.reflector.get<RateLimitOptions>('rateLimit', context.getHandler()) ||
      this.defaultOptions;

    // Generate key based on IP and user ID
    const key = this.generateKey(request);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + options.ttl * 1000,
      };
      this.store.set(key, entry);

      // Set rate limit headers
      this.setHeaders(request, options, entry);
      return true;
    }

    // Check if limit is exceeded
    if (entry.count >= options.limit) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      // Log rate limit violation
      this.logger.logSecurityEvent('rate_limit_exceeded', {
        ip: request.ip,
        userId: (request as any).user?.id,
        endpoint: request.url,
        limit: options.limit,
        retryAfter,
      });

      // Set rate limit headers
      this.setHeaders(request, options, entry);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    entry.count++;
    this.setHeaders(request, options, entry);

    return true;
  }

  private generateKey(request: Request): string {
    const userId = (request as any).user?.id;
    const ip = request.ip || request.connection.remoteAddress;

    // Use user ID if authenticated, otherwise use IP
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private setHeaders(
    request: Request,
    options: RateLimitOptions,
    entry: RateLimitStore,
  ): void {
    const response = request.res;
    if (response) {
      response.setHeader('X-RateLimit-Limit', options.limit);
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, options.limit - entry.count),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        new Date(entry.resetTime).toISOString(),
      );
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(
        `Cleaned up ${cleaned} expired rate limit entries`,
        'RateLimitGuard',
      );
    }
  }
}

// Decorator for custom rate limits
export function RateLimit(options: RateLimitOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rateLimit', options, descriptor.value);
    return descriptor;
  };
}
