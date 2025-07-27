import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { ZoomApiService } from '../videosdk/zoom-api.service';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MeetingStatusPollingService {
  private readonly logger = new Logger(MeetingStatusPollingService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private zoomApiService: ZoomApiService,
    private wsGateway: WebSocketGateway,
    private configService: ConfigService,
  ) {}

  // Run every 10 minutes as a backup to webhooks
  // Disabled frequent polling since Zoom webhooks are now handling real-time updates
  @Cron('0 */10 * * * *')
  async pollMeetingStatuses() {
    try {
      // Get all live meetings
      const liveMeetings = await this.meetingModel.find({ status: 'live' });

      if (liveMeetings.length === 0) {
        return;
      }

      this.logger.debug(
        `Checking status for ${liveMeetings.length} live meetings`,
      );

      for (const meeting of liveMeetings) {
        await this.checkMeetingStatus(meeting);
      }
    } catch (error) {
      this.logger.error('Failed to poll meeting statuses', error);
    }
  }

  private async checkMeetingStatus(meeting: MeetingDocument) {
    try {
      // Add grace period for newly started meetings (2 minutes)
      const startedAt = meeting.startedAt || meeting.updatedAt || meeting.createdAt;
      const timeSinceStart = Date.now() - new Date(startedAt).getTime();
      const gracePerioMs = 2 * 60 * 1000; // 2 minutes

      if (timeSinceStart < gracePerioMs) {
        this.logger.debug(
          `Meeting ${meeting._id} was recently started, skipping status check (${Math.round(timeSinceStart / 1000)}s ago)`,
        );
        return;
      }

      // Check if Zoom meeting still exists and is active
      if (!meeting.zoomMeetingId) {
        this.logger.warn(`Meeting ${meeting._id} has no zoomMeetingId, skipping`);
        return;
      }
      
      const isActive = await this.zoomApiService.validateMeeting(meeting.zoomMeetingId);

      if (!isActive) {
        // Meeting room no longer exists, mark as completed
        this.logger.log(
          `Meeting ${meeting._id} room no longer active, marking as completed`,
        );

        meeting.status = 'completed';
        meeting.endedAt = new Date();
        await meeting.save();

        // Emit WebSocket events
        await this.wsGateway.emitMeetingEnded(meeting._id.toString());
        await this.wsGateway.emitMeetingStatusUpdate(
          meeting._id.toString(),
          'completed',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to check status for meeting ${meeting._id}`,
        error,
      );
    }
  }

  // Method to manually trigger status check for a specific meeting
  async checkSingleMeetingStatus(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId);
    if (meeting && meeting.status === 'live') {
      await this.checkMeetingStatus(meeting);
    }
  }
}
