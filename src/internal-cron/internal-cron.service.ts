import { Injectable, Logger } from '@nestjs/common';
import { CronService } from '../cron/cron.service';
import { SubscriptionSyncCron } from '../cron/subscription-sync.cron';
import { AnnouncementService } from '../announcement/announcement.service';
import { MeetingCronService } from '../services/meeting-cron.service';

@Injectable()
export class InternalCronService {
  private readonly logger = new Logger(InternalCronService.name);

  constructor(
    private readonly cronService: CronService,
    private readonly subscriptionSyncCron: SubscriptionSyncCron,
    private readonly announcementService: AnnouncementService,
    private readonly meetingCronService: MeetingCronService,
  ) {}

  async removeExpiredSubscriptions() {
    this.logger.log('Running removeExpiredSubscriptions via internal cron');
    try {
      await this.cronService.removeExpiredSubscriptions();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in removeExpiredSubscriptions:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWeeklyRenewalReminders() {
    this.logger.log('Running sendWeeklyRenewalReminders via internal cron');
    try {
      await this.cronService.sendWeeklyRenewalReminders();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in sendWeeklyRenewalReminders:', error);
      return { success: false, error: error.message };
    }
  }

  async processFailedPayments() {
    this.logger.log('Running processFailedPayments via internal cron');
    try {
      await this.cronService.processFailedPayments();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in processFailedPayments:', error);
      return { success: false, error: error.message };
    }
  }

  async updateNextBillingDates() {
    this.logger.log('Running updateNextBillingDates via internal cron');
    try {
      await this.cronService.updateNextBillingDates();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in updateNextBillingDates:', error);
      return { success: false, error: error.message };
    }
  }

  async removeExpiredModulePermissions() {
    this.logger.log('Running removeExpiredModulePermissions via internal cron');
    try {
      await this.cronService.removeExpiredModulePermissions();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in removeExpiredModulePermissions:', error);
      return { success: false, error: error.message };
    }
  }

  async sendModulePermissionExpirationReminders() {
    this.logger.log('Running sendModulePermissionExpirationReminders via internal cron');
    try {
      await this.cronService.sendModulePermissionExpirationReminders();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in sendModulePermissionExpirationReminders:', error);
      return { success: false, error: error.message };
    }
  }

  async syncSubscriptionDates() {
    this.logger.log('Running syncSubscriptionDates via internal cron');
    try {
      await this.subscriptionSyncCron.syncSubscriptionDates();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in syncSubscriptionDates:', error);
      return { success: false, error: error.message };
    }
  }

  async hourlySyncCheck() {
    this.logger.log('Running hourlySyncCheck via internal cron');
    try {
      await this.subscriptionSyncCron.hourlySyncCheck();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in hourlySyncCheck:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupAbandonedEventCheckouts() {
    this.logger.log('Running cleanupAbandonedEventCheckouts via internal cron');
    try {
      await this.cronService.cleanupAbandonedEventCheckouts();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in cleanupAbandonedEventCheckouts:', error);
      return { success: false, error: error.message };
    }
  }

  async permanentlyDeleteExpiredUsers() {
    this.logger.log('Running permanentlyDeleteExpiredUsers via internal cron');
    try {
      await this.cronService.permanentlyDeleteExpiredUsers();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in permanentlyDeleteExpiredUsers:', error);
      return { success: false, error: error.message };
    }
  }

  async handleExpiredAnnouncements() {
    this.logger.log('Running handleExpiredAnnouncements via internal cron');
    try {
      await this.announcementService.updateExpiredAnnouncements();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in handleExpiredAnnouncements:', error);
      return { success: false, error: error.message };
    }
  }

  async handleScheduledAnnouncements() {
    this.logger.log('Running handleScheduledAnnouncements via internal cron');
    try {
      await this.announcementService.activateScheduledAnnouncements();
      return { success: true };
    } catch (error) {
      this.logger.error('Error in handleScheduledAnnouncements:', error);
      return { success: false, error: error.message };
    }
  }

  async dailyMeetingCleanup() {
    this.logger.log('Running dailyMeetingCleanup via internal cron (creation handled by Global API)');
    try {
      const result = await this.meetingCronService.dailyMeetingCleanup();
      return { success: true, result };
    } catch (error) {
      this.logger.error('Error in dailyMeetingCleanup:', error);
      return { success: false, error: error.message };
    }
  }
}
