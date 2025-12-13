import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MeetingCronService {
  private readonly logger = new Logger(MeetingCronService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private configService: ConfigService,
  ) {}

  /**
   * Daily meeting cleanup job.
   *
   * NOTE: Daily meeting CREATION has been disabled in regional APIs.
   * Meetings are now created by the Global API and synced via RabbitMQ.
   * This cron job only handles cleanup of old local meetings.
   * Globally managed meetings (isGloballyManaged: true) are NOT deleted by this cleanup
   * - they are managed by the Global API lifecycle.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyMeetingCleanup() {
    this.logger.log('Starting daily meeting cleanup (creation disabled - handled by Global API)...');

    const result = {
      deletedByStatus: 0,
      deletedByTime: 0,
      totalDeleted: 0,
      error: null as any,
    };

    try {
      // Get current time
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Calculate 30 days ago for cleanup threshold
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. Delete old completed and cancelled LOCAL meetings (NOT globally managed ones)
      // Globally managed meetings are cleaned up by the Global API
      const deleteResult = await this.meetingModel.deleteMany({
        status: { $in: ['completed', 'cancelled'] },
        isGloballyManaged: { $ne: true }, // Skip globally managed meetings
        createdAt: { $lt: thirtyDaysAgo }, // Only delete meetings older than 30 days
      });
      result.deletedByStatus = deleteResult.deletedCount;
      this.logger.log(
        `Deleted ${deleteResult.deletedCount} old completed/cancelled local meetings`,
      );

      // 2. Delete LOCAL meetings that should be considered ended based on time
      // Skip globally managed meetings - they're handled by Global API
      const endedMeetingsResult = await this.meetingModel.deleteMany({
        isGloballyManaged: { $ne: true }, // Skip globally managed meetings
        createdAt: { $lt: thirtyDaysAgo }, // Only delete meetings older than 30 days
        $or: [
          // Meetings scheduled for before today
          {
            scheduledAt: { $lt: todayStart },
          },
          // Meetings that have started and their duration has passed
          {
            startedAt: { $exists: true },
            $expr: {
              $lt: [
                { $add: ['$startedAt', { $multiply: ['$duration', 60000] }] },
                now,
              ],
            },
          },
        ],
      });
      result.deletedByTime = endedMeetingsResult.deletedCount;
      this.logger.log(
        `Deleted ${endedMeetingsResult.deletedCount} old ended local meetings`,
      );

      result.totalDeleted = result.deletedByStatus + result.deletedByTime;

      this.logger.log(
        `Daily meeting cleanup completed. Total deleted: ${result.totalDeleted}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to run daily meeting cleanup', error);
      result.error = error.message || error;
      return result;
    }
  }
}
