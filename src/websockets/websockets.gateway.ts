import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';

@WSGateway({
  cors: {
    origin: '*', // Configure this properly for production
  },
})
export class WebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-meeting')
  async handleJoinMeeting(
    @MessageBody() data: { meetingId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId, userId } = data;

    // Join the meeting room for real-time updates
    client.join(`meeting-${meetingId}`);
    this.logger.log(`User ${userId} joined meeting room ${meetingId}`);

    // Emit to all users in the meeting
    this.server.to(`meeting-${meetingId}`).emit('user-joined', { userId });
  }

  @SubscribeMessage('leave-meeting')
  async handleLeaveMeeting(
    @MessageBody() data: { meetingId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId, userId } = data;

    // Leave the meeting room
    client.leave(`meeting-${meetingId}`);
    this.logger.log(`User ${userId} left meeting room ${meetingId}`);

    // Emit to all users in the meeting
    this.server.to(`meeting-${meetingId}`).emit('user-left', { userId });
  }

  // Method to emit meeting status updates to all participants
  async emitMeetingStatusUpdate(meetingId: string, status: string) {
    const eventData = {
      meetingId,
      status,
      timestamp: new Date(),
    };

    // Emit to specific meeting room for participants
    this.server.to(`meeting-${meetingId}`).emit('meeting-status-updated', eventData);
    
    // Also emit globally for dashboard/list views
    this.server.emit('meeting-status-updated', eventData);

    this.logger.log(
      `Emitted status update for meeting ${meetingId}: ${status} (to room and globally)`,
    );
  }

  // Method to emit meeting ended event
  async emitMeetingEnded(meetingId: string) {
    const eventData = {
      meetingId,
      timestamp: new Date(),
    };

    // Emit to specific meeting room for participants
    this.server.to(`meeting-${meetingId}`).emit('meeting-ended', eventData);
    
    // Also emit globally for dashboard/list views
    this.server.emit('meeting-ended', eventData);

    this.logger.log(`Emitted meeting ended for ${meetingId} (to room and globally)`);
  }

  // Method to emit meeting started event
  async emitMeetingStarted(data: {
    meetingId: string;
    zoomMeetingId: string;
    status: string;
    startedAt: Date;
    title: string;
    host: any;
  }) {
    // Emit to specific meeting room
    this.server.to(`meeting-${data.meetingId}`).emit('meeting-started', data);
    
    // Also emit to a general live-meetings room for dashboard updates
    this.server.emit('live-meeting-update', data);

    this.logger.log(`Emitted meeting started for ${data.meetingId}`);
  }

  // LiveKit-specific event emitters
  async emitLiveKitRoomCreated(data: {
    meetingId: string;
    roomName: string;
    provider: string;
  }) {
    // Emit to specific meeting room
    this.server.to(`meeting-${data.meetingId}`).emit('livekit-room-created', data);
    
    // Also emit globally for dashboard updates
    this.server.emit('livekit-room-created', data);

    this.logger.log(`Emitted LiveKit room created for meeting ${data.meetingId}`);
  }

  async emitLiveKitParticipantJoined(data: {
    meetingId: string;
    participantId: string;
    participantName: string;
  }) {
    // Emit to meeting room
    this.server.to(`meeting-${data.meetingId}`).emit('livekit-participant-joined', data);

    this.logger.log(`Emitted LiveKit participant joined: ${data.participantName} in meeting ${data.meetingId}`);
  }

  async emitLiveKitParticipantLeft(data: {
    meetingId: string;
    participantId: string;
    participantName: string;
  }) {
    // Emit to meeting room
    this.server.to(`meeting-${data.meetingId}`).emit('livekit-participant-left', data);

    this.logger.log(`Emitted LiveKit participant left: ${data.participantName} from meeting ${data.meetingId}`);
  }
}
