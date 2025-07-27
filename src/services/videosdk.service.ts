import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class VideoSDKService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly apiEndpoint = 'https://api.videosdk.live/v2';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VIDEOSDK_API_KEY');
    this.apiSecret = this.configService.get<string>('VIDEOSDK_API_SECRET');
  }

  private getAuthToken(): string {
    // In production, you should generate JWT tokens properly
    // For now, using the API key as bearer token
    return this.apiKey;
  }

  async createRoom(options: {
    customRoomId?: string;
    autoCloseConfig?: {
      type: string;
      duration: number;
    };
  }) {
    try {
      const response = await axios.post(
        `${this.apiEndpoint}/rooms`,
        {
          customRoomId: options.customRoomId,
          autoCloseConfig: options.autoCloseConfig,
        },
        {
          headers: {
            Authorization: this.getAuthToken(),
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('VideoSDK Error:', error.response?.data || error.message);
      // Return mock data for development
      return {
        roomId: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        disabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async getRoomDetails(roomId: string) {
    try {
      const response = await axios.get(`${this.apiEndpoint}/rooms/${roomId}`, {
        headers: {
          Authorization: this.getAuthToken(),
        },
      });

      return response.data;
    } catch (error) {
      console.error('VideoSDK Error:', error.response?.data || error.message);
      return null;
    }
  }

  async validateRoom(roomId: string) {
    try {
      const response = await axios.get(
        `${this.apiEndpoint}/rooms/validate/${roomId}`,
        {
          headers: {
            Authorization: this.getAuthToken(),
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('VideoSDK Error:', error.response?.data || error.message);
      return { valid: false };
    }
  }

  async deactivateRoom(roomId: string) {
    try {
      const response = await axios.post(
        `${this.apiEndpoint}/rooms/deactivate`,
        { roomId },
        {
          headers: {
            Authorization: this.getAuthToken(),
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('VideoSDK Error:', error.response?.data || error.message);
      return null;
    }
  }

  async createToken(options: {
    roomId?: string;
    participantId?: string;
    role?: 'host' | 'guest' | 'viewer';
    permissions?: string[];
  }) {
    // In production, generate proper JWT token with permissions
    // For now, returning the API key
    return {
      token: this.getAuthToken(),
    };
  }

  async getRecordings(roomId: string) {
    try {
      const response = await axios.get(
        `${this.apiEndpoint}/recordings?roomId=${roomId}`,
        {
          headers: {
            Authorization: this.getAuthToken(),
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('VideoSDK Error:', error.response?.data || error.message);
      return { data: [] };
    }
  }
}
