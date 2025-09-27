import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AccessToken,
  RoomServiceClient,
  ParticipantInfo,
  EgressClient,
  EncodedFileOutput,
  S3Upload
} from 'livekit-server-sdk';
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
  private egressClient: EgressClient;
  private config: LiveKitConfig;

  constructor(
    private configService: ConfigService,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private wsGateway: WebSocketGateway,
  ) {
    // Use the correct environment variables that are already set
    const livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'https://live.daytradedak.com');
    
    // Parse the URL to generate WebSocket and HTTP URLs
    const wsUrl = livekitUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    
    this.config = {
      apiKey: this.configService.get<string>('LK_API_KEY', 'devkey'),
      apiSecret: this.configService.get<string>('LK_API_SECRET', 'secret'),
      wsUrl: wsUrl,
      httpUrl: httpUrl,
    };

    this.roomService = new RoomServiceClient(
      this.config.httpUrl,
      this.config.apiKey,
      this.config.apiSecret,
    );

    this.egressClient = new EgressClient(
      this.config.httpUrl,
      this.config.apiKey,
      this.config.apiSecret,
    );

    this.logger.log(`LiveKit service initialized with server: ${this.config.httpUrl}`);
    this.logger.log(`LiveKit WebSocket URL: ${this.config.wsUrl}`);
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
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (!meeting.livekitRoomName) {
      throw new BadRequestException('Meeting does not have a LiveKit room');
    }

    // Check if user is the host
    const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();
    const isHost = dto.identity === hostId;

    // Prepare metadata with host flag and user info
    const metadata = {
      isHost,
      userId: dto.identity,
      ...(dto.metadata ? JSON.parse(dto.metadata) : {})
    };

    // Create access token
    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: dto.identity,
      name: dto.name,
      metadata: JSON.stringify(metadata),
    });

    // Set video grants based on user permissions
    // Host and participants with proper permissions can publish
    const canPublish = dto.canPublish !== false;
    const canShare = isHost || dto.canPublish !== false; // Hosts can always share
    
    at.addGrant({
      roomJoin: true,
      room: meeting.livekitRoomName,
      canPublish: canPublish,
      canSubscribe: dto.canSubscribe !== false,
      canPublishData: dto.canPublishData !== false,
      hidden: dto.hidden || false,
    });

    const token = at.toJwt();
    this.logger.log(`Token generated for ${dto.name} (${isHost ? 'HOST' : 'PARTICIPANT'}) in room ${meeting.livekitRoomName}`);
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
      // Don't automatically set to 'live' - wait for host to explicitly start
      // Just log that the room was created
      this.logger.log(`LiveKit room created for meeting ${meeting._id}, waiting for host to start`);
      
      // We could emit a room-ready event if needed, but don't change status
      // await this.wsGateway.emitLiveKitRoomCreated({
      //   meetingId: meeting._id.toString(),
      //   roomName: webhook.room.name,
      //   provider: 'livekit',
      // });
    }
  }

  private async handleRoomFinished(webhook: LiveKitWebhookDto): Promise<void> {
    if (!webhook.room) return;

    const meeting = await this.meetingModel.findOne({
      livekitRoomName: webhook.room.name
    });

    if (meeting) {
      // Only mark as completed if it was explicitly ended or all participants left
      // Check if the room is truly empty (no participants)
      const numParticipants = webhook.room.numParticipants || 0;

      if (numParticipants === 0) {
        // Room is empty, safe to mark as completed
        meeting.status = 'completed';
        meeting.endedAt = new Date();
        await meeting.save();
        this.logger.log(`Meeting ${meeting._id} finished (room empty)`);

        // Emit WebSocket event
        await this.wsGateway.emitMeetingEnded(meeting._id.toString());
      } else {
        // Room still has participants, don't end the meeting
        this.logger.log(`Room finished event for meeting ${meeting._id} but ${numParticipants} participants still present`);
      }
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
        // Host left, but don't automatically end the meeting
        // Only end it if explicitly requested via endMeetingByHost API
        this.logger.log(`Host left meeting ${meeting._id}, but meeting continues`);

        // Emit event that host has left (but don't end the meeting)
        await this.wsGateway.emitLiveKitParticipantLeft({
          meetingId: meeting._id.toString(),
          participantId: webhook.participant.sid,
          participantName: webhook.participant.name || webhook.participant.identity,
        });

        // Optional: You could implement a grace period here
        // For example, end the meeting after 5 minutes if host doesn't return
        // But for now, we'll let the meeting continue until explicitly ended
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
   * Start meeting by host - updates status to 'live'
   */
  async startMeetingByHost(meetingId: string, userId: string): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is the host - handle both populated and non-populated cases
    let isHost = false;
    if (meeting.host && typeof meeting.host === 'object' && meeting.host._id) {
      // Host is populated
      isHost = meeting.host._id.toString() === userId.toString();
    } else if (meeting.host) {
      // Host is just an ID
      isHost = meeting.host.toString() === userId.toString();
    }
    
    if (!isHost) {
      this.logger.error(`User ${userId} is not the host of meeting ${meetingId}. Host is: ${meeting.host._id || meeting.host}`);
      throw new BadRequestException('Only the host can start the meeting');
    }

    // Update meeting status to 'live'
    meeting.status = 'live';
    meeting.startedAt = meeting.startedAt || new Date();
    await meeting.save();

    // Emit WebSocket event to notify all clients
    await this.wsGateway.emitMeetingStatusUpdate(meeting._id.toString(), 'live');
    await this.wsGateway.emitLiveKitRoomCreated({
      meetingId: meeting._id.toString(),
      roomName: meeting.livekitRoomName || meeting.title,
      provider: 'livekit',
    });

    this.logger.log(`Meeting ${meeting._id} started by host ${userId}`);
  }

  /**
   * End meeting by host
   */
  async endMeetingByHost(meetingId: string, userId: string): Promise<void> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is the host - handle both populated and non-populated cases
    let isHost = false;
    if (meeting.host && typeof meeting.host === 'object' && meeting.host._id) {
      // Host is populated
      isHost = meeting.host._id.toString() === userId.toString();
    } else if (meeting.host) {
      // Host is just an ID
      isHost = meeting.host.toString() === userId.toString();
    }
    
    if (!isHost) {
      this.logger.error(`User ${userId} is not the host of meeting ${meetingId}. Host is: ${meeting.host._id || meeting.host}`);
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

  /**
   * Get meeting by ID (helper method for controller)
   */
  async getMeetingById(meetingId: string): Promise<MeetingDocument> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  /**
   * Start recording a room
   */
  async startRecording(meetingId: string, userId: string): Promise<any> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is host - handle both populated and non-populated cases
    let isHost = false;
    if (meeting.host && typeof meeting.host === 'object' && meeting.host._id) {
      // Host is populated - compare both as strings
      isHost = meeting.host._id.toString() === userId.toString();
    } else if (meeting.host) {
      // Host is just an ID - compare as strings
      isHost = meeting.host.toString() === userId.toString();
    }

    this.logger.log(`Recording check - Host ID: ${meeting.host._id || meeting.host}, User ID: ${userId}, Is Host: ${isHost}`);

    if (!isHost) {
      throw new BadRequestException('Only the host can start recording');
    }

    if (!meeting.livekitRoomName) {
      throw new BadRequestException('Meeting does not have a LiveKit room');
    }

    try {
      // Start room composite egress to record the entire room
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${meeting.livekitRoomName}-${timestamp}.mp4`;

      this.logger.log(`Starting recording for room ${meeting.livekitRoomName} with filename ${filename}`);

      // Create S3 upload configuration
      const s3Upload = new S3Upload({
        accessKey: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secret: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
        bucket: 'day-trade-dak-recordings',
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      });

      // Create file output with S3 upload
      const fileOutput = new EncodedFileOutput({
        filepath: filename,
        output: {
          case: 's3',
          value: s3Upload,
        },
      });

      const egressInfo = await this.egressClient.startRoomCompositeEgress(
        meeting.livekitRoomName,
        {
          file: fileOutput,
        }
      );

      // Store egress ID for stopping later
      meeting.isRecording = true;
      meeting.egressId = egressInfo.egressId;
      await meeting.save();

      this.logger.log(`Recording started with egress ID: ${egressInfo.egressId}`);

      return {
        success: true,
        message: 'Recording started',
        meetingId,
        roomName: meeting.livekitRoomName,
        egressId: egressInfo.egressId,
        filename
      };
    } catch (error) {
      this.logger.error(`Failed to start recording: ${error.message}`);
      throw new BadRequestException(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Stop recording a room
   */
  async stopRecording(meetingId: string, userId: string): Promise<any> {
    const meeting = await this.meetingModel.findById(meetingId).populate('host');
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is host - handle both populated and non-populated cases
    let isHost = false;
    if (meeting.host && typeof meeting.host === 'object' && meeting.host._id) {
      // Host is populated - compare both as strings
      isHost = meeting.host._id.toString() === userId.toString();
    } else if (meeting.host) {
      // Host is just an ID - compare as strings
      isHost = meeting.host.toString() === userId.toString();
    }

    if (!isHost) {
      throw new BadRequestException('Only the host can stop recording');
    }

    try {
      // Stop the egress if we have an ID
      if (meeting.egressId) {
        this.logger.log(`Stopping egress with ID: ${meeting.egressId}`);
        await this.egressClient.stopEgress(meeting.egressId);
      }

      // Update meeting to indicate recording stopped
      meeting.isRecording = false;
      meeting.egressId = null;
      await meeting.save();

      this.logger.log(`Recording stopped for room ${meeting.livekitRoomName}`);

      return {
        success: true,
        message: 'Recording stopped',
        meetingId,
        roomName: meeting.livekitRoomName
      };
    } catch (error) {
      this.logger.error(`Failed to stop recording: ${error.message}`);

      // Even if stopping fails, update the database
      meeting.isRecording = false;
      meeting.egressId = null;
      await meeting.save();

      throw new BadRequestException(`Failed to stop recording: ${error.message}`);
    }
  }
}