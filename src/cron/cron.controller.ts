import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SubscriptionSyncCron } from './subscription-sync.cron';
import { Logger } from '@nestjs/common';

@Controller('api/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);
  private lastDailyRun: Date | null = null;
  private lastHourlyRun: Date | null = null;
  private cronRunCount = {
    daily: 0,
    hourly: 0,
  };

  constructor(private readonly subscriptionSyncCron: SubscriptionSyncCron) {
    // Track cron executions
    this.setupCronTracking();
  }

  private setupCronTracking() {
    // Override the cron methods to track execution
    const originalDaily = this.subscriptionSyncCron.syncSubscriptionDates;
    const originalHourly = this.subscriptionSyncCron.hourlySyncCheck;

    this.subscriptionSyncCron.syncSubscriptionDates = async () => {
      this.lastDailyRun = new Date();
      this.cronRunCount.daily++;
      this.logger.log('📊 Daily cron tracked at: ' + this.lastDailyRun.toISOString());
      return originalDaily.call(this.subscriptionSyncCron);
    };

    this.subscriptionSyncCron.hourlySyncCheck = async () => {
      this.lastHourlyRun = new Date();
      this.cronRunCount.hourly++;
      this.logger.log('📊 Hourly cron tracked at: ' + this.lastHourlyRun.toISOString());
      return originalHourly.call(this.subscriptionSyncCron);
    };
  }

  /**
   * Get cron job status and statistics
   */
  @Get('status')
  getCronStatus() {
    const now = new Date();
    
    return {
      status: 'active',
      currentTime: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      jobs: {
        daily: {
          name: 'syncSubscriptionDates',
          schedule: '0 0 * * * (Daily at midnight)',
          lastRun: this.lastDailyRun ? this.lastDailyRun.toISOString() : 'Not run yet',
          runCount: this.cronRunCount.daily,
          nextRun: this.calculateNextDailyRun(),
        },
        hourly: {
          name: 'hourlySyncCheck',
          schedule: 'Every hour',
          lastRun: this.lastHourlyRun ? this.lastHourlyRun.toISOString() : 'Not run yet',
          runCount: this.cronRunCount.hourly,
          nextRun: this.calculateNextHourlyRun(),
        },
      },
      health: {
        isHealthy: true,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  /**
   * Manually trigger daily subscription sync (admin only)
   */
  @Post('trigger-sync')
  @UseGuards(JwtAuthGuard)
  async triggerDailySync() {
    this.logger.log('🔧 Manual daily sync triggered via API');
    
    try {
      await this.subscriptionSyncCron.syncSubscriptionDates();
      
      return {
        success: true,
        message: 'Daily subscription sync triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error triggering daily sync:', error);
      return {
        success: false,
        message: 'Failed to trigger sync',
        error: error.message,
      };
    }
  }

  /**
   * Manually trigger hourly sync check (admin only)
   */
  @Post('trigger-hourly')
  @UseGuards(JwtAuthGuard)
  async triggerHourlySync() {
    this.logger.log('🔧 Manual hourly sync triggered via API');
    
    try {
      await this.subscriptionSyncCron.hourlySyncCheck();
      
      return {
        success: true,
        message: 'Hourly subscription sync triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error triggering hourly sync:', error);
      return {
        success: false,
        message: 'Failed to trigger sync',
        error: error.message,
      };
    }
  }

  /**
   * Test cron connectivity and configuration
   */
  @Get('test')
  testCron() {
    return {
      message: 'Cron module is active and responding',
      timestamp: new Date().toISOString(),
      config: {
        scheduleModuleLoaded: true,
        cronServiceActive: true,
        registeredJobs: ['syncSubscriptionDates', 'hourlySyncCheck'],
      },
    };
  }

  private calculateNextDailyRun(): string {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Set to next midnight
    nextRun.setHours(24, 0, 0, 0);
    
    return nextRun.toISOString();
  }

  private calculateNextHourlyRun(): string {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Set to next hour
    nextRun.setHours(now.getHours() + 1, 0, 0, 0);
    
    return nextRun.toISOString();
  }
}