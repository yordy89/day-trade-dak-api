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
  requireRegistration?: boolean; // Enable registration with auto-approval
  autoAdmit?: boolean; // Disable waiting room for automation
  enableChat?: boolean; // Control chat availability
  autoLockMinutes?: number; // Auto-lock meeting after X minutes
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
    this.clientSecret = this.configService.get<string>(
      'ZOOM_CLIENT_SECRET',
      '',
    );

    this.logger.log('Zoom API Service initialized');
    this.logger.log(
      `Account ID: ${this.accountId ? 'Configured' : 'NOT CONFIGURED'}`,
    );
    this.logger.log(
      `Client ID: ${this.clientId ? 'Configured' : 'NOT CONFIGURED'}`,
    );
    this.logger.log(
      `Client Secret: ${this.clientSecret ? 'Configured' : 'NOT CONFIGURED'}`,
    );

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
      const credentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');

      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'account_credentials',
          account_id: this.accountId,
        },
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      // Set expiration 5 minutes before actual expiration for safety
      this.tokenExpiresAt =
        Date.now() + (response.data.expires_in - 300) * 1000;

      this.logger.log('Successfully obtained Zoom access token');
      return this.accessToken;
    } catch (error: any) {
      this.logger.error(
        'Failed to get Zoom access token:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Failed to authenticate with Zoom API',
        HttpStatus.INTERNAL_SERVER_ERROR,
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
          approval_type: dto.requireRegistration ? 0 : 2, // 0 = Auto approve, 2 = No registration
          registration_type: dto.requireRegistration ? 1 : undefined, // 1 = Required for joining
          audio: 'both',
          auto_recording: dto.recordAutomatically ? 'cloud' : 'none',
          enforce_login: false, // Participants don't need Zoom accounts
          waiting_room: dto.autoAdmit ? false : (dto.waitingRoom ?? false), // Disable for automation
          allow_multiple_devices: false, // Prevent credential sharing
          show_join_info: false, // Hide meeting info to prevent sharing
          email_notification: false,
          registrants_confirmation_email: false, // No confirmation emails
          registrants_email_notification: false, // No notification emails
          // Security settings to prevent participants from inviting others
          meeting_invitees: [], // Empty array means no one can invite
          private_meeting: true, // Make meeting private
          show_share_button: false, // Hide share button
          allow_participants_to_rename: false, // Prevent renaming
          who_can_share_screen: 'host', // Only host can share screen
          who_can_share_screen_when_someone_is_sharing: 'host', // Only host can interrupt
          annotation: false, // Disable annotation by participants
          whiteboard: false, // Disable whiteboard for participants
          remote_control: false, // Disable remote control
          non_verbal_feedback: false, // Disable reactions
          breakout_room: false, // Disable breakout rooms
          remote_support: false, // Disable remote support
          closed_caption: false, // Disable closed captions
          far_end_camera_control: false, // Disable camera control
          share_dual_camera: false, // Disable dual camera sharing
          // Participant removal settings
          allow_removed_participants_to_rejoin: false, // Prevent removed users from rejoining
          // Chat settings
          meeting_chat: {
            enable: dto.enableChat ?? false, // Disable chat by default
            type: 1, // 1 = In-meeting chat disabled
            allow_attendees_chat_with: 1, // 1 = No one
            allow_auto_save_chat: false,
          },
          // Additional security
          enable_dedicated_group_chat: false,
          allow_show_zoom_windows: false,
          allow_live_streaming: false,
          // Lock meeting settings
          lock_meeting_after_mins: dto.autoLockMinutes, // Auto-lock after X minutes
        },
      };

      const response = await axios.post<ZoomMeetingResponse>(
        `${this.apiEndpoint}/users/me/meetings`,
        meetingData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Created Zoom meeting: ${response.data.id} - ${response.data.topic}`,
      );

      return {
        zoomMeetingId: response.data.id.toString(),
        joinUrl: response.data.join_url,
        startUrl: response.data.start_url,
        password: response.data.password,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          'Zoom API Error:',
          axiosError.response?.data || axiosError.message,
        );

        if (axiosError.response?.status === 401) {
          // Clear cached token and retry once
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          throw new HttpException(
            'Zoom authentication failed. Please check your credentials.',
            HttpStatus.UNAUTHORIZED,
          );
        }
      }

      throw new HttpException(
        error.response?.data?.message || 'Failed to create Zoom meeting',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
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
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Failed to get meeting details:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Failed to get meeting details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update meeting status or settings
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<{
      topic: string;
      start_time: string;
      duration: number;
      password: string;
      settings: any;
    }>,
  ): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      await axios.patch(`${this.apiEndpoint}/meetings/${meetingId}`, updates, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(`Updated Zoom meeting: ${meetingId}`);
    } catch (error: any) {
      this.logger.error(
        'Failed to update meeting:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Failed to update meeting',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      await axios.delete(`${this.apiEndpoint}/meetings/${meetingId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      this.logger.log(`Deleted Zoom meeting: ${meetingId}`);
    } catch (error: any) {
      this.logger.error(
        'Failed to delete meeting:',
        error.response?.data || error.message,
      );
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
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Failed to get recordings:',
        error.response?.data || error.message,
      );
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

  /**
   * Validate if a meeting exists and is active
   */
  async validateMeeting(meetingId: string, retries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const accessToken = await this.getAccessToken();
        
        const response = await axios.get<ZoomMeetingResponse>(
          `${this.apiEndpoint}/meetings/${meetingId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            timeout: 5000, // 5 second timeout
          },
        );
        
        // Check if meeting exists and is not deleted
        const isValid = response.data && response.data.status !== 'deleted';
        
        if (isValid) {
          this.logger.debug(`Zoom meeting ${meetingId} is valid, status: ${response.data.status}`);
        }
        
        return isValid;
      } catch (error: any) {
        // 404 means meeting doesn't exist
        if (error.response?.status === 404) {
          this.logger.warn(`Zoom meeting ${meetingId} not found`);
          return false;
        }
        
        this.logger.warn(
          `Failed to validate Zoom meeting ${meetingId} (attempt ${attempt}/${retries}): ${error.message}`,
        );
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        } else {
          // Log the full error on final attempt
          this.logger.error(`Failed to validate Zoom meeting ${meetingId} after ${retries} attempts`, error);
        }
      }
    }
    return false;
  }
}
