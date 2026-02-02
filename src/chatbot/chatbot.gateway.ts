import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatbotService } from './chatbot.service';
import { SendMessageDto } from './dto/chat-message.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  region?: string;
  language?: string;
}

interface ChatMessagePayload {
  message: string;
  conversationId?: string;
  region?: string;
  language?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // Configure properly for production
    credentials: true,
  },
})
export class ChatbotGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatbotGateway.name);
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Chatbot WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract and verify JWT token
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} attempted connection without token`);
        client.emit('chat:error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = this.jwtService.verify(token);
      client.userId = payload.sub || payload._id;
      client.region = client.handshake.query?.region as string || 'es';
      client.language = client.handshake.query?.language as string || 'es';

      // Track connected users
      if (!this.connectedUsers.has(client.userId)) {
        this.connectedUsers.set(client.userId, new Set());
      }
      this.connectedUsers.get(client.userId)!.add(client.id);

      // Join user's personal room for direct messages
      client.join(`user-${client.userId}`);

      this.logger.log(`Client ${client.id} connected (User: ${client.userId})`);

      // Send welcome message
      client.emit('chat:connected', {
        userId: client.userId,
        socketId: client.id,
        suggestions: this.chatbotService.getQuickSuggestions(client.language),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('chat:error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(client.userId);
        }
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @MessageBody() data: ChatMessagePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      client.emit('chat:error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Emit typing indicator
      client.emit('chat:typing', { isTyping: true });

      // Process the message
      const dto: SendMessageDto = {
        message: data.message,
        conversationId: data.conversationId,
        region: (data.region || client.region || 'es') as any,
        language: (data.language || client.language || 'es') as any,
      };

      const response = await this.chatbotService.processMessage(
        client.userId,
        dto,
      );

      // Stop typing indicator
      client.emit('chat:typing', { isTyping: false });

      // Send response
      client.emit('chat:response', response);

      // Also send to all user's connected devices
      this.server
        .to(`user-${client.userId}`)
        .except(client.id)
        .emit('chat:sync', {
          type: 'new_message',
          conversationId: response.conversationId,
          message: response.message,
        });
    } catch (error) {
      this.logger.error(`Message handling error: ${error.message}`);
      client.emit('chat:typing', { isTyping: false });
      client.emit('chat:error', {
        message: 'Failed to process message. Please try again.',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('chat:join-conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    const { conversationId } = data;

    // Join conversation room
    client.join(`conversation-${conversationId}`);

    // Get conversation history
    const history = await this.chatbotService.getConversationHistory(
      client.userId,
      conversationId,
    );

    client.emit('chat:history', history);
    this.logger.log(`User ${client.userId} joined conversation ${conversationId}`);
  }

  @SubscribeMessage('chat:leave-conversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    const { conversationId } = data;
    client.leave(`conversation-${conversationId}`);
    this.logger.log(`User ${client.userId} left conversation ${conversationId}`);
  }

  @SubscribeMessage('chat:clear')
  async handleClearConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    try {
      const { conversationId } = data;
      await this.chatbotService.clearConversation(client.userId, conversationId);

      // Notify all user's devices
      this.server.to(`user-${client.userId}`).emit('chat:sync', {
        type: 'conversation_cleared',
        conversationId,
      });

      client.emit('chat:cleared', { conversationId });
    } catch (error) {
      client.emit('chat:error', { message: 'Failed to clear conversation' });
    }
  }

  @SubscribeMessage('chat:get-suggestions')
  handleGetSuggestions(@ConnectedSocket() client: AuthenticatedSocket) {
    const suggestions = this.chatbotService.getQuickSuggestions(
      client.language || 'es',
    );
    client.emit('chat:suggestions', { suggestions });
  }

  /**
   * Send a message to a specific user (for admin notifications)
   */
  async sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user-${userId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected users (for announcements)
   */
  broadcastAnnouncement(message: string) {
    this.server.emit('chat:announcement', { message, timestamp: new Date() });
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}
