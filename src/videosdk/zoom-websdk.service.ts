import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface ZoomWebSDKSignatureDto {
  meetingNumber: string;
  role: 0 | 1; // 0 for participant, 1 for host
}

export interface ZoomWebSDKCredentials {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  role: 0 | 1;
  userName: string;
  userEmail: string;
  password?: string;
}

@Injectable()
export class ZoomWebSDKService {
  private readonly logger = new Logger(ZoomWebSDKService.name);
  private readonly sdkKey: string;
  private readonly sdkSecret: string;

  constructor(private configService: ConfigService) {
    this.sdkKey = this.configService.get<string>('ZOOM_SDK_KEY');
    this.sdkSecret = this.configService.get<string>('ZOOM_SDK_SECRET');

    this.logger.log('Zoom Web SDK Service initialized');
    this.logger.log(
      `SDK Key: ${this.sdkKey ? 'Configured' : 'NOT CONFIGURED'}`,
    );
    this.logger.log(
      `SDK Secret: ${this.sdkSecret ? 'Configured' : 'NOT CONFIGURED'}`,
    );

    if (!this.sdkKey || !this.sdkSecret) {
      this.logger.error(
        'Zoom Web SDK credentials are not properly configured. Please set ZOOM_SDK_KEY and ZOOM_SDK_SECRET environment variables.',
      );
    }
  }

  /**
   * Generate SDK JWT signature for Zoom Web SDK
   * This follows Zoom's Web SDK signature generation requirements
   * @see https://developers.zoom.us/docs/meeting-sdk/web/signature/
   */
  generateSDKSignature(dto: ZoomWebSDKSignatureDto): string {
    const { meetingNumber, role } = dto;

    if (!this.sdkKey || !this.sdkSecret) {
      throw new Error('Zoom SDK credentials are not configured');
    }

    // Current timestamp in seconds
    const iat = Math.round(Date.now() / 1000) - 30;
    // Token expiration time (4 hours from now)
    const exp = iat + 60 * 60 * 4;

    // Create the payload
    const payload = {
      sdkKey: this.sdkKey,
      mn: meetingNumber,
      role: role,
      iat: iat,
      exp: exp,
      tokenExp: exp,
    };

    // Generate the signature using HS256 algorithm
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    // Encode header and payload
    const encodedHeader = this.base64urlEscape(
      Buffer.from(JSON.stringify(header)).toString('base64'),
    );
    const encodedPayload = this.base64urlEscape(
      Buffer.from(JSON.stringify(payload)).toString('base64'),
    );

    // Create signature
    const signature = crypto
      .createHmac('sha256', this.sdkSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64');

    const encodedSignature = this.base64urlEscape(signature);

    // Combine all parts
    const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    this.logger.debug(
      `Generated SDK signature for meeting ${meetingNumber} with role ${role}`,
    );

    return jwt;
  }

  /**
   * Generate complete credentials for Zoom Web SDK
   */
  generateWebSDKCredentials(
    meetingNumber: string,
    role: 0 | 1,
    userName: string,
    userEmail: string,
    password?: string,
  ): ZoomWebSDKCredentials {
    const signature = this.generateSDKSignature({ meetingNumber, role });

    return {
      signature,
      sdkKey: this.sdkKey,
      meetingNumber,
      role,
      userName,
      userEmail,
      password,
    };
  }

  /**
   * Validate if the SDK is properly configured
   */
  isConfigured(): boolean {
    return !!(this.sdkKey && this.sdkSecret);
  }

  /**
   * Helper function to escape base64 for URL
   */
  private base64urlEscape(str: string): string {
    return str
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Validate meeting number format
   */
  validateMeetingNumber(meetingNumber: string): boolean {
    // Remove any spaces or hyphens
    const cleanNumber = meetingNumber.replace(/[\s-]/g, '');
    
    // Zoom meeting IDs are typically 9-11 digits
    return /^\d{9,11}$/.test(cleanNumber);
  }

  /**
   * Clean meeting number (remove spaces and hyphens)
   */
  cleanMeetingNumber(meetingNumber: string): string {
    return meetingNumber.replace(/[\s-]/g, '');
  }
}