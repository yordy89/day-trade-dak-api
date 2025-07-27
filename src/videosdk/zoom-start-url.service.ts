import { Injectable, Logger } from '@nestjs/common';
import { ZoomApiService } from './zoom-api.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZoomStartUrlService {
  private readonly logger = new Logger(ZoomStartUrlService.name);
  private readonly apiEndpoint = 'https://api.zoom.us/v2';

  constructor(
    private readonly zoomApiService: ZoomApiService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get a fresh start URL with valid ZAK token for the host
   * This ensures the host can always start without login
   */
  async getFreshStartUrl(meetingId: string): Promise<string> {
    try {
      // Get a fresh access token
      const accessToken = await this.zoomApiService['getAccessToken']();
      
      // Get updated meeting details with fresh start URL
      const response = await axios.get(
        `${this.apiEndpoint}/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const meeting = response.data;
      
      if (!meeting.start_url) {
        throw new Error('No start URL available for this meeting');
      }

      this.logger.log(`Retrieved fresh start URL for meeting ${meetingId}`);
      return meeting.start_url;
    } catch (error: any) {
      this.logger.error('Failed to get fresh start URL:', error);
      throw error;
    }
  }

  /**
   * Get user's ZAK token directly
   * This can be appended to any meeting URL to allow starting without login
   */
  async getUserZak(): Promise<string> {
    try {
      const accessToken = await this.zoomApiService['getAccessToken']();
      
      // Get user's ZAK token
      const response = await axios.get(
        `${this.apiEndpoint}/users/me/token?type=zak`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data.token;
    } catch (error: any) {
      this.logger.error('Failed to get user ZAK token:', error);
      throw error;
    }
  }

  /**
   * Build a start URL with ZAK token
   * This allows starting any meeting without login
   */
  buildStartUrl(meetingId: string, zak: string): string {
    return `https://zoom.us/s/${meetingId}?zak=${encodeURIComponent(zak)}`;
  }

  /**
   * Get desktop client start URL
   * This opens directly in Zoom desktop app if installed
   */
  buildDesktopStartUrl(meetingId: string, zak: string): string {
    return `zoommtg://zoom.us/start?confno=${meetingId}&zak=${encodeURIComponent(zak)}`;
  }
}