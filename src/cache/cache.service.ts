import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private redis: Redis;
  private isConnected = false;

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_DB', 0),
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          this.logger.warn(
            `Redis connection retry #${times}, delay: ${delay}ms`,
            'CacheService',
          );
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected successfully', 'CacheService');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        this.logger.error(
          'Redis connection error',
          error.stack,
          'CacheService',
        );
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed', 'CacheService');
      });
    } catch (error) {
      this.logger.error(
        'Failed to initialize Redis',
        error.stack,
        'CacheService',
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.debug(
        'Redis not connected, skipping cache get',
        'CacheService',
      );
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        `Failed to get cache key: ${key}`,
        error.stack,
        'CacheService',
      );
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.debug(
        'Redis not connected, skipping cache set',
        'CacheService',
      );
      return false;
    }

    try {
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to set cache key: ${key}`,
        error.stack,
        'CacheService',
      );
      return false;
    }
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.isConnected) {
      this.logger.debug(
        'Redis not connected, skipping cache delete',
        'CacheService',
      );
      return 0;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      return await this.redis.del(...keys);
    } catch (error) {
      this.logger.error(
        `Failed to delete cache key(s): ${key}`,
        error.stack,
        'CacheService',
      );
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check cache key existence: ${key}`,
        error.stack,
        'CacheService',
      );
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to set expiration for key: ${key}`,
        error.stack,
        'CacheService',
      );
      return false;
    }
  }

  async flushDb(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.redis.flushdb();
      this.logger.log('Redis database flushed', 'CacheService');
    } catch (error) {
      this.logger.error(
        'Failed to flush Redis database',
        error.stack,
        'CacheService',
      );
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Failed to get keys with pattern: ${pattern}`,
        error.stack,
        'CacheService',
      );
      return [];
    }
  }

  // Hash operations for more complex caching scenarios
  async hset(key: string, field: string, value: any): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const serialized = JSON.stringify(value);
      return await this.redis.hset(key, field, serialized);
    } catch (error) {
      this.logger.error(
        `Failed to hset ${key}:${field}`,
        error.stack,
        'CacheService',
      );
      return 0;
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const value = await this.redis.hget(key, field);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        `Failed to hget ${key}:${field}`,
        error.stack,
        'CacheService',
      );
      return null;
    }
  }

  async hdel(key: string, fields: string | string[]): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const fieldArray = Array.isArray(fields) ? fields : [fields];
      return await this.redis.hdel(key, ...fieldArray);
    } catch (error) {
      this.logger.error(`Failed to hdel ${key}`, error.stack, 'CacheService');
      return 0;
    }
  }

  // Increment operations for counters
  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(
        `Failed to increment key: ${key}`,
        error.stack,
        'CacheService',
      );
      return 0;
    }
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.redis.incrby(key, increment);
    } catch (error) {
      this.logger.error(
        `Failed to increment key by ${increment}: ${key}`,
        error.stack,
        'CacheService',
      );
      return 0;
    }
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      return await this.del(keys);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate pattern: ${pattern}`,
        error.stack,
        'CacheService',
      );
      return 0;
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
      this.logger.log('Redis connection closed gracefully', 'CacheService');
    }
  }

  // Utility method for cache key generation
  static generateKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}
