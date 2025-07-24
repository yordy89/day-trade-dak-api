import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZoomMeetingConfig {
  meetingId: string;
  password?: string;
  userName: string;
  userEmail: string;
  role: 'host' | 'participant';
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly defaultMeetingId: string;
  private readonly defaultPassword: string;
  private readonly zoomDomain: string;

  constructor(private configService: ConfigService) {
    // Using Personal Meeting ID approach - no API needed
    this.defaultMeetingId = this.configService.get<string>('ZOOM_PERSONAL_MEETING_ID', '');
    this.defaultPassword = this.configService.get<string>('ZOOM_MEETING_PASSWORD', '');
    this.zoomDomain = this.configService.get<string>('ZOOM_DOMAIN', 'zoom.us');

    this.logger.log('Zoom Service initialized');
    this.logger.log(`Meeting ID: ${this.defaultMeetingId ? 'Configured' : 'NOT CONFIGURED'}`);
    this.logger.log(`Password: ${this.defaultPassword ? 'Configured' : 'NOT CONFIGURED'}`);
  }

  /**
   * Generate Zoom Web Client URL for joining a meeting
   * This approach doesn't require SDK or API access
   */
  generateMeetingUrl(config: Partial<ZoomMeetingConfig>): string {
    const meetingId = config.meetingId || this.defaultMeetingId;
    const password = config.password || this.defaultPassword;
    
    if (!meetingId) {
      throw new Error('Zoom meeting ID is not configured');
    }

    // Remove spaces from meeting ID
    const cleanMeetingId = meetingId.replace(/\s/g, '');

    // Build Zoom Web Client URL
    // Format: https://zoom.us/wc/join/{meetingId}
    let url = `https://${this.zoomDomain}/wc/join/${cleanMeetingId}`;

    // Add query parameters
    const params = new URLSearchParams();
    
    // Add password if provided
    if (password) {
      params.append('pwd', password);
    }

    // Add user name if provided
    if (config.userName) {
      params.append('un', config.userName);
    }

    // Add email if provided
    if (config.userEmail) {
      params.append('email', config.userEmail);
    }

    // Prefer web client
    params.append('prefer', '1');

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    this.logger.debug(`Generated Zoom URL: ${url}`);
    return url;
  }

  /**
   * Generate host start URL
   * Hosts can use the same URL but will be prompted to sign in
   */
  generateHostUrl(config: Partial<ZoomMeetingConfig>): string {
    return this.generateMeetingUrl({
      ...config,
      role: 'host'
    });
  }

  /**
   * Check if Zoom is properly configured
   */
  isConfigured(): boolean {
    return !!this.defaultMeetingId;
  }

  /**
   * Get meeting configuration
   */
  getMeetingConfig(): { meetingId: string; hasPassword: boolean } {
    return {
      meetingId: this.defaultMeetingId,
      hasPassword: !!this.defaultPassword
    };
  }

  /**
   * Format meeting ID for display (add spaces for readability)
   */
  formatMeetingId(meetingId?: string): string {
    const id = meetingId || this.defaultMeetingId;
    if (!id) return '';
    
    // Format as XXX XXX XXXX or XXX XXXX XXXX depending on length
    const cleaned = id.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    return cleaned;
  }
}