import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnnouncementService } from '../announcement/announcement.service';

@Injectable()
export class AnnouncementCronService {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredAnnouncements() {
    try {
      await this.announcementService.updateExpiredAnnouncements();
      console.log('Expired announcements updated');
    } catch (error) {
      console.error('Error updating expired announcements:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledAnnouncements() {
    try {
      await this.announcementService.activateScheduledAnnouncements();
      console.log('Scheduled announcements checked');
    } catch (error) {
      console.error('Error activating scheduled announcements:', error);
    }
  }
}