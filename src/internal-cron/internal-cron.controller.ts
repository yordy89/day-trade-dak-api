import { Controller, Post, Get, UseGuards, Logger, HttpCode } from '@nestjs/common';
import { CronApiKeyGuard } from './guards/cron-api-key.guard';
import { InternalCronService } from './internal-cron.service';

@Controller('api/v1/internal/cron')
@UseGuards(CronApiKeyGuard)
export class InternalCronController {
  private readonly logger = new Logger(InternalCronController.name);

  constructor(private readonly internalCronService: InternalCronService) {}

  @Get('status')
  async getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      region: 'us',
      availableJobs: [
        'expired-subscriptions',
        'renewal-reminders',
        'failed-payments',
        'billing-dates',
        'expired-permissions',
        'permission-reminders',
        'subscription-sync-daily',
        'subscription-sync-hourly',
        'abandoned-checkouts',
        'user-deletion',
        'expired-announcements',
        'scheduled-announcements',
        'meeting-cleanup',
      ],
    };
  }

  @Post('expired-subscriptions')
  @HttpCode(200)
  async removeExpiredSubscriptions() {
    this.logger.log('Triggered: expired-subscriptions');
    const result = await this.internalCronService.removeExpiredSubscriptions();
    return { job: 'expired-subscriptions', result };
  }

  @Post('renewal-reminders')
  @HttpCode(200)
  async sendRenewalReminders() {
    this.logger.log('Triggered: renewal-reminders');
    const result = await this.internalCronService.sendWeeklyRenewalReminders();
    return { job: 'renewal-reminders', result };
  }

  @Post('failed-payments')
  @HttpCode(200)
  async processFailedPayments() {
    this.logger.log('Triggered: failed-payments');
    const result = await this.internalCronService.processFailedPayments();
    return { job: 'failed-payments', result };
  }

  @Post('billing-dates')
  @HttpCode(200)
  async updateBillingDates() {
    this.logger.log('Triggered: billing-dates');
    const result = await this.internalCronService.updateNextBillingDates();
    return { job: 'billing-dates', result };
  }

  @Post('expired-permissions')
  @HttpCode(200)
  async removeExpiredPermissions() {
    this.logger.log('Triggered: expired-permissions');
    const result = await this.internalCronService.removeExpiredModulePermissions();
    return { job: 'expired-permissions', result };
  }

  @Post('permission-reminders')
  @HttpCode(200)
  async sendPermissionReminders() {
    this.logger.log('Triggered: permission-reminders');
    const result = await this.internalCronService.sendModulePermissionExpirationReminders();
    return { job: 'permission-reminders', result };
  }

  @Post('subscription-sync-daily')
  @HttpCode(200)
  async subscriptionSyncDaily() {
    this.logger.log('Triggered: subscription-sync-daily');
    const result = await this.internalCronService.syncSubscriptionDates();
    return { job: 'subscription-sync-daily', result };
  }

  @Post('subscription-sync-hourly')
  @HttpCode(200)
  async subscriptionSyncHourly() {
    this.logger.log('Triggered: subscription-sync-hourly');
    const result = await this.internalCronService.hourlySyncCheck();
    return { job: 'subscription-sync-hourly', result };
  }

  @Post('abandoned-checkouts')
  @HttpCode(200)
  async cleanupAbandonedCheckouts() {
    this.logger.log('Triggered: abandoned-checkouts');
    const result = await this.internalCronService.cleanupAbandonedEventCheckouts();
    return { job: 'abandoned-checkouts', result };
  }

  @Post('user-deletion')
  @HttpCode(200)
  async permanentlyDeleteUsers() {
    this.logger.log('Triggered: user-deletion');
    const result = await this.internalCronService.permanentlyDeleteExpiredUsers();
    return { job: 'user-deletion', result };
  }

  @Post('expired-announcements')
  @HttpCode(200)
  async handleExpiredAnnouncements() {
    this.logger.log('Triggered: expired-announcements');
    const result = await this.internalCronService.handleExpiredAnnouncements();
    return { job: 'expired-announcements', result };
  }

  @Post('scheduled-announcements')
  @HttpCode(200)
  async handleScheduledAnnouncements() {
    this.logger.log('Triggered: scheduled-announcements');
    const result = await this.internalCronService.handleScheduledAnnouncements();
    return { job: 'scheduled-announcements', result };
  }

  @Post('meeting-cleanup')
  @HttpCode(200)
  async meetingCleanup() {
    this.logger.log('Triggered: meeting-cleanup (creation handled by Global API)');
    const result = await this.internalCronService.dailyMeetingCleanup();
    return { job: 'meeting-cleanup', result };
  }
}
