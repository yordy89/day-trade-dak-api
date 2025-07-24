import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';

export interface CreateZoomMeetingDto {
  topic: string;
  scheduledAt: Date;
  duration: number; // in minutes
  password?: string;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  muteUponEntry?: boolean;
  recordAutomatically?: boolean;
}

export interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password: string;
  h323_password: string;
  pstn_password: string;
  encrypted_password: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    cn_meeting: boolean;
    in_meeting: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
    enforce_login: boolean;
    enforce_login_domains: string;
    alternative_hosts: string;
    close_registration: boolean;
    show_share_button: boolean;
    allow_multiple_devices: boolean;
    registrants_confirmation_email: boolean;
    waiting_room: boolean;
    request_permission_to_unmute_participants: boolean;
    registrants_email_notification: boolean;
    meeting_authentication: boolean;
    encryption_type: string;
    approved_or_denied_countries_or_regions: {
      enable: boolean;
    };
    breakout_room: {
      enable: boolean;
    };
    device_testing: boolean;
    alternative_hosts_email_notification: boolean;
    show_join_info: boolean;
    focus_mode: boolean;
    enable_dedicated_group_chat: boolean;
    private_meeting: boolean;
    email_notification: boolean;
    host_save_video_order: boolean;
    sign_language_interpretation: {
      enable: boolean;
    };
    email_in_attendee_report: boolean;
  };
}

@Injectable()
export class ZoomApiService {
  private readonly logger = new Logger(ZoomApiService.name);
  private readonly apiEndpoint = 'https://api.zoom.us/v2';
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private configService: ConfigService) {
    // Server-to-Server OAuth App credentials
    this.accountId = this.configService.get<string>('ZOOM_ACCOUNT_ID', '');
    this.clientId = this.configService.get<string>('ZOOM_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET', '');

    this.logger.log('Zoom API Service initialized');
    this.logger.log(`Account ID: ${this.accountId ? 'Configured' : 'NOT CONFIGURED'}`);
    this.logger.log(`Client ID: ${this.clientId ? 'Configured' : 'NOT CONFIGURED'}`);
    this.logger.log(`Client Secret: ${this.clientSecret ? 'Configured' : 'NOT CONFIGURED'}`);

    if (!this.accountId || !this.clientId || !this.clientSecret) {
      this.logger.error('Zoom API credentials are not fully configured');
    }
  }

  /**
   * Get OAuth access token using Server-to-Server OAuth
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.accountId,
          },
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiration 5 minutes before actual expiration for safety
      this.tokenExpiresAt = Date.now() + ((response.data.expires_in - 300) * 1000);
      
      this.logger.log('Successfully obtained Zoom access token');
      return this.accessToken;
    } catch (error: any) {
      this.logger.error('Failed to get Zoom access token:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to authenticate with Zoom API',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create a new Zoom meeting
   */
  async createMeeting(dto: CreateZoomMeetingDto): Promise<{
    zoomMeetingId: string;
    joinUrl: string;
    startUrl: string;
    password: string;
  }> {
    try {
      const accessToken = await this.getAccessToken();
      
      const meetingData = {
        topic: dto.topic,
        type: 2, // Scheduled meeting
        start_time: dto.scheduledAt.toISOString(),
        duration: dto.duration,
        timezone: 'America/New_York', // You can make this configurable
        password: dto.password || this.generatePassword(),
        agenda: dto.topic,
        settings: {
          host_video: true,
          participant_video: true,
          cn_meeting: false,
          in_meeting: false,
          join_before_host: dto.joinBeforeHost ?? false,
          mute_upon_entry: dto.muteUponEntry ?? true,
          watermark: false,
          use_pmi: false, // Always create unique meeting IDs
          approval_type: 2, // No registration required
          audio: 'both',
          auto_recording: dto.recordAutomatically ? 'cloud' : 'none',
          enforce_login: false,
          waiting_room: dto.waitingRoom ?? true,
          allow_multiple_devices: true,
          show_join_info: true,
          email_notification: false,
        },
      };

      const response = await axios.post<ZoomMeetingResponse>(
        `${this.apiEndpoint}/users/me/meetings`,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`Created Zoom meeting: ${response.data.id} - ${response.data.topic}`);

      return {
        zoomMeetingId: response.data.id.toString(),
        joinUrl: response.data.join_url,
        startUrl: response.data.start_url,
        password: response.data.password,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error('Zoom API Error:', axiosError.response?.data || axiosError.message);
        
        if (axiosError.response?.status === 401) {
          // Clear cached token and retry once
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          throw new HttpException(
            'Zoom authentication failed. Please check your credentials.',
            HttpStatus.UNAUTHORIZED
          );
        }
      }
      
      throw new HttpException(
        error.response?.data?.message || 'Failed to create Zoom meeting',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get<ZoomMeetingResponse>(
        `${this.apiEndpoint}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get meeting details:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to get meeting details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update meeting status or settings
   */
  async updateMeeting(meetingId: string, updates: Partial<{
    topic: string;
    start_time: string;
    duration: number;
    password: string;
    settings: any;
  }>): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      
      await axios.patch(
        `${this.apiEndpoint}/meetings/${meetingId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`Updated Zoom meeting: ${meetingId}`);
    } catch (error: any) {
      this.logger.error('Failed to update meeting:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to update meeting',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      
      await axios.delete(
        `${this.apiEndpoint}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      this.logger.log(`Deleted Zoom meeting: ${meetingId}`);
    } catch (error: any) {
      this.logger.error('Failed to delete meeting:', error.response?.data || error.message);
      // Don't throw error for delete - meeting might already be deleted
    }
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.apiEndpoint}/meetings/${meetingId}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get recordings:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Generate a secure password
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Check if Zoom API is properly configured
   */
  isConfigured(): boolean {
    return !!(this.accountId && this.clientId && this.clientSecret);
  }
}