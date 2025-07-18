import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { VideoSDKService } from '../videosdk/videosdk.service';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MeetingStatusPollingService {
  private readonly logger = new Logger(MeetingStatusPollingService.name);
  private readonly apiKey: string;
  private readonly apiEndpoint = 'https://api.videosdk.live/v2';

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private videoSDKService: VideoSDKService,
    private wsGateway: WebSocketGateway,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('VIDEOSDK_API_KEY');
  }

  // Run every 30 seconds to check live meetings
  @Cron('*/30 * * * * *')
  async pollMeetingStatuses() {
    try {
      // Get all live meetings
      const liveMeetings = await this.meetingModel.find({ status: 'live' });
      
      if (liveMeetings.length === 0) {
        return;
      }

      this.logger.debug(`Checking status for ${liveMeetings.length} live meetings`);

      for (const meeting of liveMeetings) {
        await this.checkMeetingStatus(meeting);
      }
    } catch (error) {
      this.logger.error('Failed to poll meeting statuses', error);
    }
  }

  private async checkMeetingStatus(meeting: MeetingDocument) {
    try {
      // Check if meeting room still exists and is active
      const isActive = await this.videoSDKService.validateRoom(meeting.meetingId);
      
      if (!isActive) {
        // Meeting room no longer exists, mark as completed
        this.logger.log(`Meeting ${meeting._id} room no longer active, marking as completed`);
        
        meeting.status = 'completed';
        meeting.endedAt = new Date();
        await meeting.save();
        
        // Emit WebSocket events
        await this.wsGateway.emitMeetingEnded(meeting._id.toString());
        await this.wsGateway.emitMeetingStatusUpdate(meeting._id.toString(), 'completed');
      }
    } catch (error) {
      this.logger.error(`Failed to check status for meeting ${meeting._id}`, error);
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