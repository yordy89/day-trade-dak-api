import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

export interface CreateMeetingDto {
  title?: string;
  mode?: 'CONFERENCE' | 'WEBINAR' | 'INTERACTIVE';
  webhookUrl?: string;
  autoStartRecording?: boolean;
}

export interface MeetingResponse {
  roomId: string;
  token: string;
  createdAt: string;
}

export interface GenerateTokenDto {
  roomId: string;
  participantId: string;
  participantName: string;
  role: 'host' | 'participant';
}

@Injectable()
export class VideoSDKService {
  private readonly logger = new Logger(VideoSDKService.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly apiEndpoint: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VIDEOSDK_API_KEY');
    this.secretKey = this.configService.get<string>('VIDEOSDK_SECRETE_KEY'); // Note: typo in env var name
    this.apiEndpoint = 'https://api.videosdk.live/v2';

    this.logger.log('VideoSDK Service initialized');
    this.logger.log(`API Key: ${this.apiKey ? 'Configured' : 'NOT CONFIGURED'}`);
    this.logger.log(`Secret Key: ${this.secretKey ? 'Configured' : 'NOT CONFIGURED'}`);
    this.logger.log('Tokens will be generated dynamically for each API call');

    if (!this.apiKey) {
      this.logger.error('VideoSDK API key is not configured');
    }
    if (!this.secretKey) {
      this.logger.error('VideoSDK secret key is not configured');
    }
  }

  private getHeaders() {
    // Generate a fresh token for each API call
    const token = this.generateApiToken();
    this.logger.debug(`Generated fresh token: ${token.substring(0, 50)}...`);
    return {
      Authorization: token, // VideoSDK expects just the token, not "Bearer token"
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generate a token for VideoSDK API calls (not for participants)
   * This generates a fresh token for each API call with proper permissions
   */
  private generateApiToken(): string {
    if (!this.secretKey || !this.apiKey) {
      throw new Error('VideoSDK API key or secret key is not configured');
    }

    const payload = {
      apikey: this.apiKey,
      permissions: ['allow_join', 'allow_mod', 'allow_record', 'allow_stream'],
    };

    const token = jwt.sign(payload, this.secretKey, {
      algorithm: 'HS256',
      expiresIn: '1h', // Short-lived tokens for security
    });

    return token;
  }

  /**
   * Create a new meeting room
   */
  async createMeeting(_dto: CreateMeetingDto): Promise<MeetingResponse> {
    try {
      this.logger.log('Creating meeting with VideoSDK API');
      this.logger.debug(`API Endpoint: ${this.apiEndpoint}/rooms`);
      
      // Create room
      const roomResponse = await axios.post(
        `${this.apiEndpoint}/rooms`,
        {},
        { headers: this.getHeaders() },
      );

      const roomId = roomResponse.data.roomId;
      this.logger.log(`Meeting created successfully: ${roomId}`);

      // Return the room ID (token will be generated when participants join)
      return {
        roomId,
        token: '', // Token will be generated per participant when they join
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to create meeting',
        error.response?.data || error.message,
      );
      this.logger.error('Response status:', error.response?.status);
      this.logger.error('Response headers:', error.response?.headers);
      // Don't pass through 401 errors from VideoSDK as they cause frontend to redirect to login
      // The user is authenticated, the issue is with VideoSDK API credentials
      const statusCode = error.response?.status === 401 
        ? HttpStatus.INTERNAL_SERVER_ERROR 
        : (error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
      
      throw new HttpException(
        error.response?.data?.error || error.response?.data?.message || 'Failed to create meeting with VideoSDK',
        statusCode,
      );
    }
  }

  /**
   * Generate authentication token for a participant
   */
  async generateToken(dto: GenerateTokenDto): Promise<string> {
    try {
      this.logger.log(`Generating token for participant: ${dto.participantName}, role: ${dto.role}`);
      
      if (!this.secretKey) {
        this.logger.error('VideoSDK secret key is not configured');
        throw new Error('VideoSDK secret key is not configured');
      }
      
      if (!this.apiKey) {
        this.logger.error('VideoSDK API key is not configured');
        throw new Error('VideoSDK API key is not configured');
      }
      
      // Set permissions based on role
      const permissions = dto.role === 'host' 
        ? ['allow_join', 'allow_mod', 'ask_join'] // Host gets full moderator permissions
        : ['allow_join']; // Participants only get join permission
      
      const payload = {
        apikey: this.apiKey,
        permissions: permissions,
        participantId: dto.participantId,
        participantName: dto.participantName,
      };

      // Sign the token with the SECRET key (NOT the API key)
      const token = jwt.sign(payload, this.secretKey, {
        algorithm: 'HS256',
        expiresIn: '24h',
      });

      this.logger.log(`Generated ${dto.role} token with permissions: ${permissions.join(', ')}`);
      return token;
    } catch (error: any) {
      this.logger.error('Failed to generate token - Error details:', error.message || error);
      this.logger.error('Stack trace:', error.stack);
      throw new HttpException(
        `Failed to generate token: ${error.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validate if a room exists
   */
  async validateRoom(roomId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.apiEndpoint}/rooms/validate/${roomId}`,
        { headers: this.getHeaders() },
      );
      return response.data.roomId === roomId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start recording for a meeting
   */
  async startRecording(roomId: string, webhookUrl?: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiEndpoint}/recordings/start`,
        {
          roomId,
          webhookUrl,
          config: {
            layout: {
              type: 'SPOTLIGHT',
              priority: 'SPEAKER',
              gridSize: 4,
            },
            theme: 'DARK',
            quality: 'high',
          },
        },
        { headers: this.getHeaders() },
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        'Failed to start recording',
        error.response?.data || error.message,
      );
      return false;
    }
  }

  /**
   * Stop recording for a meeting
   */
  async stopRecording(roomId: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiEndpoint}/recordings/stop`,
        { roomId },
        { headers: this.getHeaders() },
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        'Failed to stop recording',
        error.response?.data || error.message,
      );
      return false;
    }
  }

  /**
   * Get recordings for a meeting
   */
  async getRecordings(roomId: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.apiEndpoint}/recordings?roomId=${roomId}`,
        { headers: this.getHeaders() },
      );
      return response.data.data || [];
    } catch (error: any) {
      this.logger.error(
        'Failed to get recordings',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
