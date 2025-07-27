import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { User, UserDocument } from '../users/user.schema';
import { ZoomApiService } from '../videosdk/zoom-api.service';
import axios from 'axios';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway } from '../websockets/websockets.gateway';

export interface ZoomWebhookEvent {
  event: string;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      participant?: {
        user_id: string;
        user_name: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
  event_ts: number;
}

@Injectable()
export class ZoomWebhooksService {
  private readonly logger = new Logger(ZoomWebhooksService.name);
  private readonly webhookToken: string;
  private readonly apiEndpoint = 'https://api.zoom.us/v2';
  
  // Track authorized participants per meeting
  private authorizedParticipants = new Map<string, Set<string>>();
  
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private zoomApiService: ZoomApiService,
    private configService: ConfigService,
    private wsGateway: WebSocketGateway,
  ) {
    this.webhookToken = this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN', '');
    this.logger.log('ZoomWebhooksService initialized');
  }

  /**
   * Validate webhook signature from Zoom
   */
  validateWebhookSignature(
    body: string,
    signature: string,
    timestamp: string,
  ): boolean {
    const message = `v0:${timestamp}:${body}`;
    const hash = crypto
      .createHmac('sha256', this.webhookToken)
      .update(message)
      .digest('hex');
    const expectedSignature = `v0=${hash}`;
    
    return signature === expectedSignature;
  }

  /**
   * Handle participant joined event
   */
  async handleParticipantJoined(event: ZoomWebhookEvent): Promise<void> {
    const { object: meeting } = event.payload;
    const participant = meeting.participant;
    
    if (!participant) return;
    
    this.logger.log(
      `Participant ${participant.user_name} (${participant.email}) joined meeting ${meeting.id}`,
    );
    
    // Find the meeting in our database
    const dbMeeting = await this.meetingModel.findOne({
      zoomMeetingId: meeting.id.toString(),
    });
    
    if (!dbMeeting) {
      this.logger.warn(`Meeting ${meeting.id} not found in database`);
      return;
    }
    
    // Check if participant is authorized
    const isAuthorized = await this.validateParticipant(
      dbMeeting,
      participant.email || participant.user_name,
    );
    
    if (!isAuthorized) {
      this.logger.warn(
        `Unauthorized participant ${participant.user_name} in meeting ${meeting.id}`,
      );
      
      // Remove unauthorized participant
      await this.removeParticipant(meeting.id.toString(), participant.user_id);
      
      // Log security event
      await this.logSecurityEvent(dbMeeting._id.toString(), {
        type: 'unauthorized_join',
        participant: participant.user_name,
        email: participant.email,
        action: 'removed',
      });
    } else {
      // Track authorized participant
      this.trackAuthorizedParticipant(meeting.id.toString(), participant.user_id);
    }
  }

  /**
   * Validate if a participant is authorized to join
   */
  private async validateParticipant(
    meeting: MeetingDocument,
    participantIdentifier: string,
  ): Promise<boolean> {
    // Check if it's the host
    const host = await this.userModel.findById(meeting.host);
    if (host && (host.email === participantIdentifier || 
        `${host.firstName} ${host.lastName}` === participantIdentifier)) {
      return true;
    }
    
    // Check if participant is in the meeting's participant list
    const authorizedUsers = await this.userModel.find({
      _id: { $in: meeting.participants },
    });
    
    const isInParticipantList = authorizedUsers.some(
      user => user.email === participantIdentifier ||
        `${user.firstName} ${user.lastName}` === participantIdentifier
    );
    
    if (isInParticipantList) {
      return true;
    }
    
    // Check if participant has required subscription
    if (meeting.restrictedToSubscriptions && meeting.allowedSubscriptions?.length > 0) {
      const user = await this.userModel.findOne({ email: participantIdentifier });
      if (user) {
        const hasRequiredSubscription = meeting.allowedSubscriptions.some(
          requiredSub => user.subscriptions?.some(sub => {
            const plan = typeof sub === 'string' ? sub : sub.plan;
            return plan === requiredSub;
          })
        );
        return hasRequiredSubscription;
      }
    }
    
    // For public meetings, allow if not restricted
    if (meeting.isPublic && !meeting.restrictedToSubscriptions) {
      return true;
    }
    
    return false;
  }

  /**
   * Remove a participant from the meeting
   */
  private async removeParticipant(
    meetingId: string,
    participantId: string,
  ): Promise<void> {
    try {
      const accessToken = await this.zoomApiService['getAccessToken']();
      
      await axios.delete(
        `${this.apiEndpoint}/meetings/${meetingId}/participants/${participantId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      
      this.logger.log(
        `Removed participant ${participantId} from meeting ${meetingId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to remove participant ${participantId}: ${error.message}`,
      );
    }
  }

  /**
   * Lock a meeting to prevent new participants
   */
  async lockMeeting(meetingId: string): Promise<void> {
    try {
      const accessToken = await this.zoomApiService['getAccessToken']();
      
      await axios.patch(
        `${this.apiEndpoint}/meetings/${meetingId}/status`,
        { action: 'lock' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      
      this.logger.log(`Locked meeting ${meetingId}`);
    } catch (error: any) {
      this.logger.error(`Failed to lock meeting ${meetingId}: ${error.message}`);
    }
  }

  /**
   * Handle meeting started event
   */
  async handleMeetingStarted(event: ZoomWebhookEvent): Promise<void> {
    const { object: meeting } = event.payload;
    
    // Clear any previous authorized participants
    this.authorizedParticipants.set(meeting.id.toString(), new Set());
    
    // Update meeting status in database
    const updatedMeeting = await this.meetingModel.findOneAndUpdate(
      { zoomMeetingId: meeting.id.toString() },
      { 
        status: 'live',
        startedAt: new Date(meeting.start_time),
      },
      { new: true }
    ).populate('host', 'firstName lastName email');
    
    if (updatedMeeting) {
      // Emit WebSocket event to notify all clients
      await this.wsGateway.emitMeetingStatusUpdate(updatedMeeting._id.toString(), 'live');
      
      // Emit specific event for meeting started
      await this.wsGateway.emitMeetingStarted({
        meetingId: updatedMeeting._id.toString(),
        zoomMeetingId: meeting.id.toString(),
        status: 'live',
        startedAt: new Date(meeting.start_time),
        title: updatedMeeting.title,
        host: updatedMeeting.host,
      });
    }
    
    this.logger.log(`Meeting ${meeting.id} started and WebSocket events emitted`);
  }

  /**
   * Handle meeting ended event
   */
  async handleMeetingEnded(event: ZoomWebhookEvent): Promise<void> {
    const { object: meeting } = event.payload;
    
    this.logger.log(`[ZOOM WEBHOOK] Processing meeting.ended event for Zoom meeting ID: ${meeting.id}`);
    
    // Clear authorized participants
    this.authorizedParticipants.delete(meeting.id.toString());
    
    // Update meeting status in database
    this.logger.log(`[ZOOM WEBHOOK] Looking for meeting with zoomMeetingId: ${meeting.id}`);
    const updatedMeeting = await this.meetingModel.findOneAndUpdate(
      { zoomMeetingId: meeting.id.toString() },
      { 
        status: 'completed',
        endedAt: new Date(),
      },
      { new: true }
    );
    
    if (updatedMeeting) {
      this.logger.log(`[ZOOM WEBHOOK] Found and updated meeting: ${updatedMeeting._id}, title: ${updatedMeeting.title}`);
      
      // Emit WebSocket event to notify all clients
      this.logger.log(`[ZOOM WEBHOOK] Emitting meeting-status-updated for meeting ID: ${updatedMeeting._id}`);
      await this.wsGateway.emitMeetingStatusUpdate(updatedMeeting._id.toString(), 'completed');
      
      // Emit specific event for meeting ended
      this.logger.log(`[ZOOM WEBHOOK] Emitting meeting-ended for meeting ID: ${updatedMeeting._id}`);
      await this.wsGateway.emitMeetingEnded(updatedMeeting._id.toString());
      
      this.logger.log(`[ZOOM WEBHOOK] Successfully emitted WebSocket events for ended meeting: ${updatedMeeting._id}`);
    } else {
      this.logger.warn(`[ZOOM WEBHOOK] No meeting found in database with zoomMeetingId: ${meeting.id}`);
    }
    
    this.logger.log(`[ZOOM WEBHOOK] Meeting.ended processing complete for Zoom meeting ID: ${meeting.id}`);
  }

  /**
   * Track authorized participants
   */
  private trackAuthorizedParticipant(meetingId: string, participantId: string): void {
    if (!this.authorizedParticipants.has(meetingId)) {
      this.authorizedParticipants.set(meetingId, new Set());
    }
    this.authorizedParticipants.get(meetingId).add(participantId);
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(
    meetingId: string,
    event: any,
  ): Promise<void> {
    // You can implement a security audit log collection here
    this.logger.warn(`Security Event: ${JSON.stringify(event)}`);
    
    // Optionally update meeting with security events
    await this.meetingModel.updateOne(
      { _id: meetingId },
      { 
        $push: {
          securityEvents: {
            ...event,
            timestamp: new Date(),
          },
        },
      },
    );
  }

  /**
   * Get list of authorized participants for a meeting
   */
  async getAuthorizedParticipants(meetingId: string): Promise<string[]> {
    const meeting = await this.meetingModel
      .findOne({ zoomMeetingId: meetingId })
      .populate('host participants');
    
    if (!meeting) return [];
    
    const authorized: string[] = [];
    
    // Add host
    if (meeting.host) {
      const host = meeting.host as any;
      authorized.push(host.email);
    }
    
    // Add participants
    if (meeting.participants?.length > 0) {
      const participants = meeting.participants as any[];
      participants.forEach(p => authorized.push(p.email));
    }
    
    return authorized;
  }
}