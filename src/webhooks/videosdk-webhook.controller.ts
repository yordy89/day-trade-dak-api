import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';

interface VideoSDKWebhookEvent {
  webhookType: string;
  data: {
    meetingId: string;
    roomId?: string;
    participantId?: string;
    sessionId?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    // Add more fields as needed based on VideoSDK webhook documentation
  };
}

@ApiTags('webhooks')
@Controller('webhooks')
export class VideoSDKWebhookController {
  private readonly logger = new Logger(VideoSDKWebhookController.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
  ) {}

  @Post('videosdk')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Hide from Swagger docs
  async handleVideoSDKWebhook(
    @Body() event: VideoSDKWebhookEvent,
    @Headers('x-videosdk-signature') signature: string,
  ) {
    this.logger.log(`Received VideoSDK webhook: ${event.webhookType}`);
    this.logger.debug('Webhook data:', JSON.stringify(event.data));

    try {
      switch (event.webhookType) {
        case 'session-started':
          await this.handleSessionStarted(event.data);
          break;
        
        case 'session-ended':
          await this.handleSessionEnded(event.data);
          break;
        
        case 'participant-joined':
          await this.handleParticipantJoined(event.data);
          break;
        
        case 'participant-left':
          await this.handleParticipantLeft(event.data);
          break;
        
        case 'recording-started':
          await this.handleRecordingStarted(event.data);
          break;
        
        case 'recording-stopped':
          await this.handleRecordingStopped(event.data);
          break;
        
        default:
          this.logger.warn(`Unhandled webhook type: ${event.webhookType}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Return success to avoid webhook retries
      return { received: true, error: error.message };
    }
  }

  private async handleSessionStarted(data: any) {
    const { meetingId, roomId } = data;
    
    const meeting = await this.meetingModel.findOne({ 
      meetingId: roomId || meetingId 
    });
    
    if (meeting && meeting.status !== 'live') {
      meeting.status = 'live';
      meeting.startedAt = new Date(data.startTime || Date.now());
      await meeting.save();
      this.logger.log(`Meeting ${meeting._id} marked as live`);
    }
  }

  private async handleSessionEnded(data: any) {
    const { meetingId, roomId, duration } = data;
    
    const meeting = await this.meetingModel.findOne({ 
      meetingId: roomId || meetingId 
    });
    
    if (meeting && meeting.status === 'live') {
      meeting.status = 'completed';
      meeting.endedAt = new Date(data.endTime || Date.now());
      if (duration) {
        meeting.duration = Math.ceil(duration / 60); // Convert to minutes
      }
      await meeting.save();
      this.logger.log(`Meeting ${meeting._id} marked as completed`);
    }
  }

  private async handleParticipantJoined(data: any) {
    const { roomId, participantId } = data;
    
    const meeting = await this.meetingModel.findOne({ meetingId: roomId });
    
    if (meeting && participantId) {
      // Add to attendees if not already there
      if (!meeting.attendees.includes(participantId)) {
        meeting.attendees.push(participantId);
        await meeting.save();
        this.logger.log(`Participant ${participantId} added to meeting ${meeting._id}`);
      }
    }
  }

  private async handleParticipantLeft(data: any) {
    const { roomId, participantId } = data;
    
    const meeting = await this.meetingModel.findOne({ meetingId: roomId });
    
    if (meeting) {
      this.logger.log(`Participant ${participantId} left meeting ${meeting._id}`);
      // Note: We don't remove from attendees as they did attend
      
      // If this was the host and no other participants, end the meeting
      if (meeting.host.toString() === participantId && meeting.status === 'live') {
        // Check if there are other participants still in the meeting
        // This would require additional tracking or VideoSDK API call
        this.logger.log('Host left the meeting, considering ending it');
      }
    }
  }

  private async handleRecordingStarted(data: any) {
    const { roomId } = data;
    
    const meeting = await this.meetingModel.findOne({ meetingId: roomId });
    
    if (meeting) {
      meeting.enableRecording = true;
      await meeting.save();
      this.logger.log(`Recording started for meeting ${meeting._id}`);
    }
  }

  private async handleRecordingStopped(data: any) {
    const { roomId, recordingUrl } = data;
    
    const meeting = await this.meetingModel.findOne({ meetingId: roomId });
    
    if (meeting && recordingUrl) {
      meeting.recordingUrl = recordingUrl;
      await meeting.save();
      this.logger.log(`Recording URL saved for meeting ${meeting._id}`);
    }
  }
}