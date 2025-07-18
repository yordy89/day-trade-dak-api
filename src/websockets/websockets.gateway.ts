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
  namespace: '/meetings',
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
    this.server.to(`meeting-${meetingId}`).emit('meeting-status-updated', {
      meetingId,
      status,
      timestamp: new Date(),
    });
    
    this.logger.log(`Emitted status update for meeting ${meetingId}: ${status}`);
  }

  // Method to emit meeting ended event
  async emitMeetingEnded(meetingId: string) {
    this.server.to(`meeting-${meetingId}`).emit('meeting-ended', {
      meetingId,
      timestamp: new Date(),
    });
    
    this.logger.log(`Emitted meeting ended for ${meetingId}`);
  }
}