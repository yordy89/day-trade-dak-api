import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { ZoomApiService } from '../videosdk/zoom-api.service';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class MeetingCronService {
  private readonly logger = new Logger(MeetingCronService.name);
  private readonly defaultHostId: string;

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private zoomApiService: ZoomApiService,
    private configService: ConfigService,
  ) {
    // Get default host ID from config or use a fallback
    this.defaultHostId =
      this.configService.get<string>('DEFAULT_MEETING_HOST_ID') || '';
  }

  // Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyMeetingCleanupAndCreate() {
    this.logger.log('Starting daily meeting cleanup and creation...');

    const result = {
      deletedByStatus: 0,
      deletedByTime: 0,
      deletedDailyLive: 0,
      totalDeleted: 0,
      meetingCreated: false,
      createdMeeting: null as any,
      error: null as any,
      message: null as string,
    };

    try {
      // Get current time
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Delete all completed and cancelled meetings
      const deleteResult = await this.meetingModel.deleteMany({
        status: { $in: ['completed', 'cancelled'] },
      });
      result.deletedByStatus = deleteResult.deletedCount;
      this.logger.log(
        `Deleted ${deleteResult.deletedCount} completed/cancelled meetings`,
      );

      // 2. Delete meetings that should be considered ended based on time
      // - Meetings scheduled for before today
      // - Meetings that started more than their duration ago
      // - Meetings scheduled for today that are past their end time
      const endedMeetingsResult = await this.meetingModel.deleteMany({
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
                { $add: ['$startedAt', { $multiply: ['$duration', 60000] }] }, // duration in milliseconds
                now,
              ],
            },
          },
          // Today's meetings that are past their scheduled end time
          {
            scheduledAt: { $gte: todayStart },
            $expr: {
              $lt: [
                { $add: ['$scheduledAt', { $multiply: ['$duration', 60000] }] },
                now,
              ],
            },
          },
        ],
      });
      result.deletedByTime = endedMeetingsResult.deletedCount;
      this.logger.log(
        `Deleted ${endedMeetingsResult.deletedCount} ended meetings based on time`,
      );

      // 3. Check if today is a weekday (Mon-Fri)
      const today = new Date();
      const dayOfWeek = today.getDay();

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Monday = 1, Friday = 5
        this.logger.log(
          `Today is a weekday (${this.getDayName(dayOfWeek)}), checking for existing daily meeting...`,
        );

        // Check if a daily meeting already exists for today BEFORE deleting
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        const existingMeeting = await this.meetingModel.findOne({
          meetingType: 'daily_live',
          scheduledAt: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
          status: { $in: ['scheduled', 'live'] },
        });

        if (existingMeeting) {
          this.logger.log(
            `Daily meeting already exists for today: ${existingMeeting._id}`,
          );
          result.message = 'Daily meeting already exists for today';
          
          // Clean up old daily_live meetings from previous days
          const oldDailyDeleteResult = await this.meetingModel.deleteMany({
            meetingType: 'daily_live',
            scheduledAt: { $lt: startOfToday },
          });
          result.deletedDailyLive = oldDailyDeleteResult.deletedCount;
          this.logger.log(
            `Deleted ${oldDailyDeleteResult.deletedCount} old daily live meetings from previous days`,
          );
          
          result.totalDeleted =
            result.deletedByStatus + result.deletedByTime + result.deletedDailyLive;
          
          return result;
        }

        // Delete any orphaned daily_live meetings (should not exist but just in case)
        const dailyDeleteResult = await this.meetingModel.deleteMany({
          meetingType: 'daily_live',
          scheduledAt: { $lt: startOfToday }, // Only delete old ones, not today's
        });
        result.deletedDailyLive = dailyDeleteResult.deletedCount;
        this.logger.log(
          `Deleted ${dailyDeleteResult.deletedCount} old daily live meetings`,
        );

        result.totalDeleted =
          result.deletedByStatus + result.deletedByTime + result.deletedDailyLive;

        // 4. Create new daily meeting for today at 8:45 AM New York time
        // Convert 8:45 AM New York to UTC
        const scheduledAt = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        scheduledAt.setHours(8, 45, 0, 0);

        // Convert back to UTC for storage
        const nyOffset = this.getNewYorkOffset(scheduledAt);
        const scheduledAtUTC = new Date(scheduledAt.getTime() + nyOffset * 60 * 1000);

        // Get the host - try to find an admin user if no default host is configured
        let hostId = this.defaultHostId;
        if (!hostId) {
          const adminUser = await this.userModel.findOne({
            role: { $in: ['admin', 'super_admin'] },
          });
          if (adminUser) {
            hostId = adminUser._id.toString();
          } else {
            this.logger.error(
              'No admin user found and no default host configured',
            );
            return;
          }
        }

        try {
          // Create Zoom meeting
          const zoomMeeting = await this.zoomApiService.createMeeting({
            topic: 'Analysis de Trading en Vivo',
            scheduledAt: scheduledAtUTC,
            duration: 240,
            recordAutomatically: true,
            enableChat: true,
            waitingRoom: false,
            autoAdmit: true, // Auto-admit participants
            autoLockMinutes: 10, // Lock after 10 minutes
            joinBeforeHost: false,
            muteUponEntry: true,
          });

          // Construct the complete Zoom URL with password
          let completeZoomUrl = zoomMeeting.joinUrl;
          if (zoomMeeting.password) {
            // Add password to the URL if not already present
            const joinUrl = new URL(zoomMeeting.joinUrl);
            if (!joinUrl.searchParams.has('pwd')) {
              joinUrl.searchParams.set('pwd', zoomMeeting.password);
            }
            completeZoomUrl = joinUrl.toString();
          }

          // Create meeting in database with Zoom details
          const meetingData = {
            title: 'Analysis de Trading en Vivo',
            description:
              'Análisis diario en vivo de operaciones y sesión de preguntas y respuestas (Q&A)',
            meetingId: zoomMeeting.zoomMeetingId,
            roomUrl: completeZoomUrl, // Use the URL with password included
            zoomMeetingId: zoomMeeting.zoomMeetingId,
            zoomJoinUrl: zoomMeeting.joinUrl,
            zoomStartUrl: zoomMeeting.startUrl,
            zoomPassword: zoomMeeting.password,
            scheduledAt: scheduledAtUTC,
            duration: 240,
            host: hostId,
            status: 'scheduled',
            isRecurring: false, // Not recurring anymore
            meetingType: 'daily_live',
            maxParticipants: 500,
            enableRecording: true,
            enableChat: true,
            enableScreenShare: true,
            isPublic: false,
            participants: [], // Start with empty participants
            restrictedToSubscriptions: true,
            allowedSubscriptions: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
          };

          const meeting = await this.meetingModel.create(meetingData);

          this.logger.log(
            `Created daily Zoom meeting for ${scheduledAtUTC.toISOString()} (8:45 AM New York time) with meeting ID: ${zoomMeeting.zoomMeetingId}`,
          );

          result.meetingCreated = true;
          result.createdMeeting = meeting;
        } catch (error) {
          this.logger.error('Failed to create daily meeting:', error);
          this.logger.error('Error details:', JSON.stringify(error, null, 2));
          result.error = error.message || error;
        }
      } else {
        this.logger.log(
          `Today is ${this.getDayName(dayOfWeek)} (weekend), skipping daily meeting creation`,
        );
        
        // Clean up old daily_live meetings on weekends
        const dailyDeleteResult = await this.meetingModel.deleteMany({
          meetingType: 'daily_live',
          scheduledAt: { $lt: new Date() },
        });
        result.deletedDailyLive = dailyDeleteResult.deletedCount;
        if (dailyDeleteResult.deletedCount > 0) {
          this.logger.log(
            `Deleted ${dailyDeleteResult.deletedCount} old daily live meetings`,
          );
        }
        
        result.totalDeleted =
          result.deletedByStatus + result.deletedByTime + result.deletedDailyLive;
      }

      this.logger.log('Daily meeting cleanup and creation completed');
      return result;
    } catch (error) {
      this.logger.error(
        'Failed to run daily meeting cleanup and creation',
        error,
      );
      result.error = error.message || error;
      return result;
    }
  }

  private getDayName(dayNumber: number): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[dayNumber];
  }

  /**
   * Get the offset in minutes from UTC for New York timezone
   * Handles both EST (-300) and EDT (-240) automatically
   */
  private getNewYorkOffset(date: Date): number {
    const nyDateStr = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const utcDateStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const nyDate = new Date(nyDateStr);
    const utcDate = new Date(utcDateStr);
    return (utcDate.getTime() - nyDate.getTime()) / (1000 * 60);
  }
}
