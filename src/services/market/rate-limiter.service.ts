import { Injectable, Logger } from '@nestjs/common';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestQueue {
  resolve: () => void;
  reject: (error: any) => void;
  timestamp: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  
  // Finnhub free tier: 60 calls per minute, 30 calls per second
  private readonly configs: Record<string, RateLimitConfig> = {
    finnhub: {
      maxRequests: 60,
      windowMs: 60000, // 1 minute
    },
    finnhubBurst: {
      maxRequests: 30,
      windowMs: 1000, // 1 second
    },
  };
  
  private requestCounts: Record<string, number[]> = {};
  private requestQueues: Record<string, RequestQueue[]> = {};
  private processing: Record<string, boolean> = {};

  constructor() {
    // Initialize counters
    Object.keys(this.configs).forEach(key => {
      this.requestCounts[key] = [];
      this.requestQueues[key] = [];
      this.processing[key] = false;
    });
  }

  /**
   * Check if request can proceed immediately
   */
  canProceed(service: string = 'finnhub'): boolean {
    const config = this.configs[service];
    if (!config) return true;
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Clean old requests
    this.requestCounts[service] = this.requestCounts[service].filter(
      timestamp => timestamp > windowStart
    );
    
    // Check both minute and burst limits for Finnhub
    if (service === 'finnhub') {
      const burstCheck = this.canProceed('finnhubBurst');
      const minuteCheck = this.requestCounts[service].length < config.maxRequests;
      return burstCheck && minuteCheck;
    }
    
    return this.requestCounts[service].length < config.maxRequests;
  }

  /**
   * Wait for rate limit clearance
   */
  async waitForSlot(service: string = 'finnhub'): Promise<void> {
    if (this.canProceed(service)) {
      this.recordRequest(service);
      return;
    }
    
    // Add to queue
    return new Promise((resolve, reject) => {
      const queue = this.requestQueues[service];
      queue.push({
        resolve,
        reject,
        timestamp: Date.now(),
      });
      
      this.logger.debug(`Request queued for ${service}. Queue size: ${queue.length}`);
      
      // Process queue
      if (!this.processing[service]) {
        this.processQueue(service);
      }
    });
  }

  /**
   * Record a request
   */
  private recordRequest(service: string): void {
    const now = Date.now();
    this.requestCounts[service].push(now);
    
    // Also record for burst limit
    if (service === 'finnhub') {
      this.requestCounts['finnhubBurst'].push(now);
    }
  }

  /**
   * Process queued requests
   */
  private async processQueue(service: string): Promise<void> {
    if (this.processing[service]) return;
    
    this.processing[service] = true;
    const config = this.configs[service];
    const queue = this.requestQueues[service];
    
    while (queue.length > 0) {
      // Wait for next available slot
      if (!this.canProceed(service)) {
        const oldestRequest = Math.min(...this.requestCounts[service]);
        const waitTime = Math.max(0, config.windowMs - (Date.now() - oldestRequest) + 100);
        
        this.logger.debug(`Rate limit reached for ${service}. Waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Process next request
      const request = queue.shift();
      if (request) {
        // Check if request has timed out (> 30 seconds)
        if (Date.now() - request.timestamp > 30000) {
          request.reject(new Error('Request timed out in rate limit queue'));
          continue;
        }
        
        this.recordRequest(service);
        request.resolve();
        
        // Small delay between requests to prevent bursts
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    this.processing[service] = false;
  }

  /**
   * Get current rate limit status
   */
  getStatus(service: string = 'finnhub'): any {
    const config = this.configs[service];
    if (!config) return null;
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const currentRequests = this.requestCounts[service].filter(
      timestamp => timestamp > windowStart
    );
    
    return {
      service,
      used: currentRequests.length,
      limit: config.maxRequests,
      remaining: config.maxRequests - currentRequests.length,
      resetIn: currentRequests.length > 0 
        ? config.windowMs - (now - Math.min(...currentRequests))
        : 0,
      queueSize: this.requestQueues[service].length,
    };
  }

  /**
   * Get all rate limit statuses
   */
  getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    
    Object.keys(this.configs).forEach(service => {
      statuses[service] = this.getStatus(service);
    });
    
    return statuses;
  }

  /**
   * Reset rate limits (for testing)
   */
  reset(service?: string): void {
    if (service) {
      this.requestCounts[service] = [];
      this.requestQueues[service] = [];
      this.processing[service] = false;
    } else {
      Object.keys(this.configs).forEach(key => {
        this.requestCounts[key] = [];
        this.requestQueues[key] = [];
        this.processing[key] = false;
      });
    }
    
    this.logger.debug(`Rate limits reset for ${service || 'all services'}`);
  }

  /**
   * Execute function with rate limiting
   */
  async execute<T>(
    fn: () => Promise<T>,
    service: string = 'finnhub',
  ): Promise<T> {
    await this.waitForSlot(service);
    
    try {
      return await fn();
    } catch (error) {
      // Don't count failed requests against rate limit
      const now = Date.now();
      const index = this.requestCounts[service].findIndex(
        timestamp => Math.abs(timestamp - now) < 100
      );
      
      if (index !== -1) {
        this.requestCounts[service].splice(index, 1);
      }
      
      throw error;
    }
  }

  /**
   * Batch execute with rate limiting
   */
  async executeBatch<T>(
    fns: Array<() => Promise<T>>,
    service: string = 'finnhub',
    batchSize: number = 5,
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < fns.length; i += batchSize) {
      const batch = fns.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(fn => this.execute(fn, service))
      );
      
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + batchSize < fns.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}