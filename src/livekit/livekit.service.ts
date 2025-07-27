import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessToken, RoomServiceClient, ParticipantInfo } from 'livekit-server-sdk';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { CreateLiveKitRoomDto } from './dto/create-livekit-room.dto';
import { JoinLiveKitRoomDto } from './dto/join-livekit-room.dto';
import { LiveKitWebhookDto } from './dto/livekit-webhook.dto';
import { LiveKitConfig, LiveKitTokenOptions } from './interfaces/livekit-config.interface';
import { WebSocketGateway } from '../websockets/websockets.gateway';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private roomService: RoomServiceClient;
  private config: LiveKitConfig;

  constructor(
    private configService: ConfigService,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private wsGateway: WebSocketGateway,
  ) {
    this.config = {
      apiKey: this.configService.get<string>('LIVEKIT_API_KEY', 'devkey'),
      apiSecret: this.configService.get<string>('LIVEKIT_API_SECRET', 'secret'),
      wsUrl: this.configService.get<string>('LIVEKIT_WS_URL', 'ws://localhost:7880'),
      httpUrl: this.configService.get<string>('LIVEKIT_HTTP_URL', 'http://localhost:7880'),
    };

    this.roomService = new RoomServiceClient(
      this.config.httpUrl,
      this.config.apiKey,
      this.config.apiSecret,
    );

    this.logger.log('LiveKit service initialized');
  }

  /**
   * Create a LiveKit room for a meeting
   */
  async createRoom(dto: CreateLiveKitRoomDto): Promise<any> {
    const meeting = await this.meetingModel.findById(dto.meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Use meeting ID as room name if not provided
    const roomName = dto.roomName || `meeting_${dto.meetingId}`;

    try {
      // Create room in LiveKit
      const room = await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: dto.emptyTimeout || 300, // 5 minutes
        maxParticipants: dto.maxParticipants || meeting.maxParticipants || 100,
        metadata: JSON.stringify({
          meetingId: dto.meetingId,
          meetingTitle: meeting.title,
          ...dto.metadata,
        }),
      });

      // Update meeting with LiveKit details
      meeting.provider = 'livekit';
      meeting.livekitRoomName = roomName;
      meeting.livekitRoomSid = room.sid;
      meeting.livekitMetadata = {
        recordingEnabled: dto.enableRecording || false,
        maxParticipants: dto.maxParticipants || meeting.maxParticipants,
        roomType: meeting.meetingType,
      };
      await meeting.save();

      this.logger.log(`LiveKit room created: ${roomName} (${room.sid})`);
      return room;
    } catch (error) {
      this.logger.error('Failed to create LiveKit room', error);
      throw new BadRequestException('Failed to create LiveKit room');
    }
  }

  /**
   * Generate access token for a participant
   */
  async generateToken(meetingId: string, dto: JoinLiveKitRoomDto): Promise<string> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (!meeting.livekitRoomName) {
      throw new BadRequestException('Meeting does not have a LiveKit room');
    }

    // Create access token
    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: dto.identity,
      name: dto.name,
      metadata: dto.metadata,
    });

    // Set video grants
    at.addGrant({
      roomJoin: true,
      room: meeting.livekitRoomName,
      canPublish: dto.canPublish !== false,
      canSubscribe: dto.canSubscribe !== false,
      canPublishData: dto.canPublishData !== false,
      hidden: dto.hidden || false,
    });

    const token = at.toJwt();
    this.logger.log(`Token generated for ${dto.name} in room ${meeting.livekitRoomName}`);
    return token;
  }

  /**
   * Get room information
   */
  async getRoomInfo(meetingId: string): Promise<any> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || !meeting.livekitRoomName) {
      throw new NotFoundException('LiveKit room not found');
    }

    try {
      const rooms = await this.roomService.listRooms([meeting.livekitRoomName]);
      return rooms[0] || null;
    } catch (error) {
      this.logger.error('Failed to get room info', error);
      return null;
    }
  }

  /**
   * List participants in a room
   */
  async listParticipants(meetingId: string): Promise<ParticipantInfo[]> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || !meeting.livekitRoomName) {
      throw new NotFoundException('LiveKit room not found');
    }

    try {
      const participants = await this.roomService.listParticipants(meeting.livekitRoomName);
      return participants;
    } catch (error) {
      this.logger.error('Failed to list participants', error);
      return [];
    }
  }

  /**
   * Remove a participant from room
   */
  async removeParticipant(meetingId: string, participantId: string): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || !meeting.livekitRoomName) {
      throw new NotFoundException('LiveKit room not found');
    }

    try {
      await this.roomService.removeParticipant(meeting.livekitRoomName, participantId);
      this.logger.log(`Participant ${participantId} removed from room ${meeting.livekitRoomName}`);
    } catch (error) {
      this.logger.error('Failed to remove participant', error);
      throw new BadRequestException('Failed to remove participant');
    }
  }

  /**
   * Delete a room
   */
  async deleteRoom(meetingId: string): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting || !meeting.livekitRoomName) {
      return; // Room doesn't exist, nothing to delete
    }

    try {
      await this.roomService.deleteRoom(meeting.livekitRoomName);
      
      // Update meeting status
      meeting.status = 'completed';
      meeting.endedAt = new Date();
      await meeting.save();

      this.logger.log(`LiveKit room deleted: ${meeting.livekitRoomName}`);
    } catch (error) {
      this.logger.error('Failed to delete room', error);
      // Don't throw error, room might already be deleted
    }
  }

  /**
   * Handle LiveKit webhooks
   */
  async handleWebhook(webhook: LiveKitWebhookDto): Promise<void> {
    this.logger.log(`Received LiveKit webhook: ${webhook.event}`);

    switch (webhook.event) {
      case 'room_started':
        await this.handleRoomStarted(webhook);
        break;
      case 'room_finished':
        await this.handleRoomFinished(webhook);
        break;
      case 'participant_joined':
        await this.handleParticipantJoined(webhook);
        break;
      case 'participant_left':
        await this.handleParticipantLeft(webhook);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${webhook.event}`);
    }
  }

  private async handleRoomStarted(webhook: LiveKitWebhookDto): Promise<void> {
    if (!webhook.room) return;

    const meeting = await this.meetingModel.findOne({ 
      livekitRoomName: webhook.room.name 
    });

    if (meeting) {
      meeting.status = 'live';
      meeting.startedAt = new Date(webhook.room.creationTime * 1000);
      await meeting.save();
      this.logger.log(`Meeting ${meeting._id} started`);
      
      // Emit WebSocket event
      await this.wsGateway.emitMeetingStatusUpdate(meeting._id.toString(), 'live');
      await this.wsGateway.emitLiveKitRoomCreated({
        meetingId: meeting._id.toString(),
        roomName: webhook.room.name,
        provider: 'livekit',
      });
    }
  }

  private async handleRoomFinished(webhook: LiveKitWebhookDto): Promise<void> {
    if (!webhook.room) return;

    const meeting = await this.meetingModel.findOne({ 
      livekitRoomName: webhook.room.name 
    });

    if (meeting) {
      meeting.status = 'completed';
      meeting.endedAt = new Date();
      await meeting.save();
      this.logger.log(`Meeting ${meeting._id} finished`);
      
      // Emit WebSocket event
      await this.wsGateway.emitMeetingEnded(meeting._id.toString());
    }
  }

  private async handleParticipantJoined(webhook: LiveKitWebhookDto): Promise<void> {
    if (!webhook.room || !webhook.participant) return;

    const meeting = await this.meetingModel.findOne({ 
      livekitRoomName: webhook.room.name 
    });

    if (meeting) {
      // Add to attendees if not already present
      const participantId = webhook.participant.identity;
      if (!meeting.attendees.includes(participantId as any)) {
        meeting.attendees.push(participantId as any);
        await meeting.save();
      }
      this.logger.log(`Participant ${webhook.participant.name} joined meeting ${meeting._id}`);
      
      // Emit WebSocket event
      await this.wsGateway.emitLiveKitParticipantJoined({
        meetingId: meeting._id.toString(),
        participantId: webhook.participant.sid,
        participantName: webhook.participant.name || webhook.participant.identity,
      });
    }
  }

  private async handleParticipantLeft(webhook: LiveKitWebhookDto): Promise<void> {
    if (!webhook.room || !webhook.participant) return;

    const meeting = await this.meetingModel.findOne({ 
      livekitRoomName: webhook.room.name 
    }).populate('host');

    if (meeting) {
      this.logger.log(`Participant ${webhook.participant.name} (${webhook.participant.identity}) left meeting ${meeting._id}`);
      
      // Check if the leaving participant is the host
      const participantMetadata = webhook.participant.metadata ? 
        JSON.parse(webhook.participant.metadata) : {};
      const isHost = participantMetadata.isHost || 
        webhook.participant.identity === meeting.host._id?.toString() ||
        webhook.participant.identity === meeting.host.toString();

      if (isHost) {
        this.logger.log(`Host is leaving meeting ${meeting._id}, ending meeting for all participants`);
        
        // Delete the LiveKit room to disconnect all participants
        try {
          await this.roomService.deleteRoom(meeting.livekitRoomName);
          this.logger.log(`LiveKit room ${meeting.livekitRoomName} deleted`);
        } catch (error) {
          this.logger.error(`Failed to delete LiveKit room: ${error.message}`);
        }
        
        // Update meeting status
        meeting.status = 'completed';
        meeting.endedAt = new Date();
        await meeting.save();
        
        // Emit meeting ended event
        await this.wsGateway.emitMeetingEnded(meeting._id.toString());
        await this.wsGateway.emitMeetingStatusUpdate(meeting._id.toString(), 'completed');
      } else {
        // Regular participant left
        await this.wsGateway.emitLiveKitParticipantLeft({
          meetingId: meeting._id.toString(),
          participantId: webhook.participant.sid,
          participantName: webhook.participant.name || webhook.participant.identity,
        });
      }
    }
  }

  /**
   * End meeting by host
   */
  async endMeetingByHost(meetingId: string, userId: string): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is the host
    const isHost = meeting.host._id?.toString() === userId || 
                   meeting.host.toString() === userId;
    
    if (!isHost) {
      throw new BadRequestException('Only the host can end the meeting');
    }

    if (meeting.livekitRoomName) {
      // Delete the LiveKit room to disconnect all participants
      try {
        await this.roomService.deleteRoom(meeting.livekitRoomName);
        this.logger.log(`LiveKit room ${meeting.livekitRoomName} deleted by host`);
      } catch (error) {
        this.logger.error(`Failed to delete LiveKit room: ${error.message}`);
      }
    }

    // Update meeting status
    meeting.status = 'completed';
    meeting.endedAt = new Date();
    await meeting.save();

    // Emit meeting ended events
    await this.wsGateway.emitMeetingEnded(meeting._id.toString());
    await this.wsGateway.emitMeetingStatusUpdate(meeting._id.toString(), 'completed');

    this.logger.log(`Meeting ${meeting._id} ended by host ${userId}`);
  }

  /**
   * Get LiveKit connection info for client
   */
  getConnectionInfo(): { wsUrl: string; httpUrl: string } {
    return {
      wsUrl: this.config.wsUrl,
      httpUrl: this.config.httpUrl,
    };
  }
}