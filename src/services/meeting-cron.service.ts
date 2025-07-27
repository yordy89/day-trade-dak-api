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

      // 3. Delete any existing daily_live meetings (they should be recreated fresh daily)
      const dailyDeleteResult = await this.meetingModel.deleteMany({
        meetingType: 'daily_live',
      });
      result.deletedDailyLive = dailyDeleteResult.deletedCount;
      this.logger.log(
        `Deleted ${dailyDeleteResult.deletedCount} daily live meetings`,
      );

      result.totalDeleted =
        result.deletedByStatus + result.deletedByTime + result.deletedDailyLive;

      // 3. Check if today is a weekday (Mon-Fri)
      const today = new Date();
      const dayOfWeek = today.getDay();

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Monday = 1, Friday = 5
        this.logger.log(
          `Today is a weekday (${this.getDayName(dayOfWeek)}), creating daily meeting...`,
        );

        // 4. Create new daily meeting for today at 8:45 AM
        const scheduledAt = new Date(today);
        scheduledAt.setHours(8, 45, 0, 0);

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

        // Check if a daily meeting already exists for today
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
          return result;
        }

        try {
          // Create Zoom meeting
          const zoomMeeting = await this.zoomApiService.createMeeting({
            topic: 'Analysis de Trading en Vivo',
            scheduledAt,
            duration: 60,
            recordAutomatically: true,
            enableChat: true,
            waitingRoom: false,
            autoAdmit: true, // Auto-admit participants
            autoLockMinutes: 10, // Lock after 10 minutes
            joinBeforeHost: false,
            muteUponEntry: true,
          });

          // Create meeting in database with Zoom details
          const meetingData = {
            title: 'Analysis de Trading en Vivo',
            description:
              'Análisis diario en vivo de operaciones y sesión de preguntas y respuestas (Q&A)',
            meetingId: zoomMeeting.zoomMeetingId,
            roomUrl: zoomMeeting.joinUrl,
            zoomMeetingId: zoomMeeting.zoomMeetingId,
            zoomJoinUrl: zoomMeeting.joinUrl,
            zoomStartUrl: zoomMeeting.startUrl,
            zoomPassword: zoomMeeting.password,
            scheduledAt,
            duration: 60,
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
            allowedSubscriptions: ['LiveWeeklyManual', 'LiveWeeklyRecurring', 'MasterClases'],
          };

          const meeting = await this.meetingModel.create(meetingData);

          this.logger.log(
            `Created daily Zoom meeting for ${scheduledAt.toISOString()} with meeting ID: ${zoomMeeting.zoomMeetingId}`,
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
}
