import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import * as crypto from 'crypto';

export interface MeetingAccessToken {
  meetingId: string;
  userId: string;
  role: 'host' | 'participant';
  exp: number; // Expiration timestamp
  jti: string; // Unique token ID
  singleUse: boolean;
}

export interface AccessLinkResponse {
  accessLink: string;
  expiresIn: number; // seconds
  meetingId: string;
  zoomMeetingId: string;
  password: string;
}

@Injectable()
export class MeetingAccessTokensService {
  private readonly logger = new Logger(MeetingAccessTokensService.name);
  private readonly secret: string;
  private readonly baseUrl: string;
  
  // Track used single-use tokens
  private usedTokens = new Set<string>();
  
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.secret = this.configService.get<string>('JWT_SECRET');
    this.baseUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /**
   * Generate a time-limited access link for a meeting
   */
  async generateAccessLink(
    meetingId: string,
    userId: string,
    role: 'host' | 'participant',
    expiresInMinutes: number = 5,
    singleUse: boolean = true,
  ): Promise<AccessLinkResponse> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new UnauthorizedException('Meeting not found');
    }

    // Generate unique token ID
    const jti = crypto.randomBytes(16).toString('hex');
    
    // Create token payload
    const payload: MeetingAccessToken = {
      meetingId,
      userId,
      role,
      exp: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60),
      jti,
      singleUse,
    };

    // Sign token
    const token = this.jwtService.sign(payload, {
      secret: this.secret,
      expiresIn: `${expiresInMinutes}m`,
    });

    // Create access link
    const accessLink = `${this.baseUrl}/meetings/join?token=${token}`;

    this.logger.log(
      `Generated access link for user ${userId} to meeting ${meetingId} (expires in ${expiresInMinutes} minutes)`,
    );

    return {
      accessLink,
      expiresIn: expiresInMinutes * 60,
      meetingId: meeting._id.toString(),
      zoomMeetingId: meeting.zoomMeetingId,
      password: meeting.zoomPassword,
    };
  }

  /**
   * Validate an access token and return meeting details
   */
  async validateAccessToken(token: string): Promise<{
    meeting: MeetingDocument;
    userId: string;
    role: 'host' | 'participant';
  }> {
    try {
      // Verify token
      const payload = this.jwtService.verify<MeetingAccessToken>(token, {
        secret: this.secret,
      });

      // Check if single-use token has been used
      if (payload.singleUse && this.usedTokens.has(payload.jti)) {
        throw new UnauthorizedException('Token has already been used');
      }

      // Get meeting
      const meeting = await this.meetingModel.findById(payload.meetingId);
      if (!meeting) {
        throw new UnauthorizedException('Meeting not found');
      }

      // Mark token as used if single-use
      if (payload.singleUse) {
        this.usedTokens.add(payload.jti);
        
        // Clean up old tokens periodically
        if (this.usedTokens.size > 10000) {
          this.cleanupUsedTokens();
        }
      }

      return {
        meeting,
        userId: payload.userId,
        role: payload.role,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access link has expired');
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }

  /**
   * Generate bulk access links for multiple participants
   */
  async generateBulkAccessLinks(
    meetingId: string,
    participants: Array<{ userId: string; email: string }>,
    expiresInMinutes: number = 30,
  ): Promise<Array<{ userId: string; email: string; accessLink: string }>> {
    const links = await Promise.all(
      participants.map(async (participant) => {
        const linkData = await this.generateAccessLink(
          meetingId,
          participant.userId,
          'participant',
          expiresInMinutes,
          true,
        );
        
        return {
          userId: participant.userId,
          email: participant.email,
          accessLink: linkData.accessLink,
        };
      }),
    );

    return links;
  }

  /**
   * Revoke all access tokens for a meeting
   */
  async revokeMeetingTokens(meetingId: string): Promise<void> {
    // In a production system, you would store tokens in a database
    // and mark them as revoked. For now, we'll just log it.
    this.logger.log(`Revoking all tokens for meeting ${meetingId}`);
    
    // You could implement a blacklist here
    // this.blacklistedMeetings.add(meetingId);
  }

  /**
   * Clean up expired used tokens
   */
  private cleanupUsedTokens(): void {
    // In production, this should be done with a database
    // For now, we'll just clear old tokens
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Simple cleanup - in production, track expiration times
    if (this.usedTokens.size > 5000) {
      this.usedTokens.clear();
      this.logger.log('Cleared used tokens cache');
    }
  }

  /**
   * Generate a secure meeting join URL with embedded token
   */
  async generateSecureJoinUrl(
    meetingId: string,
    userId: string,
    role: 'host' | 'participant',
  ): Promise<string> {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new UnauthorizedException('Meeting not found');
    }

    // Generate short-lived token (2 minutes)
    const token = await this.generateAccessLink(meetingId, userId, role, 2, true);
    
    // Return direct Zoom URL with token verification endpoint
    const baseUrl = role === 'host' ? meeting.zoomStartUrl : meeting.zoomJoinUrl;
    
    // You could implement a redirect service that validates the token
    // then redirects to the actual Zoom URL
    return `${this.baseUrl}/api/meetings/secure-join?token=${token.accessLink.split('token=')[1]}`;
  }
}