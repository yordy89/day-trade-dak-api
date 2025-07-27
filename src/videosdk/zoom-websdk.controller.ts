import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RequestWithUser } from '../auth/auth.interfaces';
import { ZoomWebSDKService } from './zoom-websdk.service';
import { UserService } from '../users/users.service';

export class GenerateZoomSignatureDto {
  meetingNumber: string;
  role?: 0 | 1; // 0 for participant, 1 for host (default: 0)
  userName?: string;
  userEmail?: string;
  password?: string;
}

@Controller('zoom-websdk')
@UseGuards(JwtAuthGuard)
export class ZoomWebSDKController {
  constructor(
    private readonly zoomWebSDKService: ZoomWebSDKService,
    private readonly userService: UserService,
  ) {}

  /**
   * Check if Zoom Web SDK is configured
   */
  @Get('status')
  async getStatus() {
    const isConfigured = this.zoomWebSDKService.isConfigured();
    return {
      configured: isConfigured,
      message: isConfigured
        ? 'Zoom Web SDK is properly configured'
        : 'Zoom Web SDK credentials are missing',
    };
  }

  /**
   * Generate SDK signature and credentials for joining a Zoom meeting
   * This endpoint validates user access and returns credentials for the Web SDK
   */
  @Post('signature')
  async generateSignature(
    @Body() dto: GenerateZoomSignatureDto,
    @Req() req: RequestWithUser,
  ) {
    try {
      // Validate SDK configuration
      if (!this.zoomWebSDKService.isConfigured()) {
        throw new HttpException(
          'Zoom Web SDK is not properly configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Clean and validate meeting number
      const cleanMeetingNumber = this.zoomWebSDKService.cleanMeetingNumber(
        dto.meetingNumber,
      );
      
      if (!this.zoomWebSDKService.validateMeetingNumber(cleanMeetingNumber)) {
        throw new HttpException(
          'Invalid meeting number format. Meeting number should be 9-11 digits.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get authenticated user information
      const authUser = req.user;
      let userName = dto.userName;
      let userEmail = dto.userEmail;

      // If user details not provided, fetch from authenticated user
      if (!userName || !userEmail) {
        try {
          const fullUser = await this.userService.findById(authUser._id);
          if (fullUser) {
            userName = userName || `${fullUser.firstName} ${fullUser.lastName}`.trim();
            userEmail = userEmail || fullUser.email;
          }
        } catch (error) {
          this.logger.warn('Failed to fetch full user details', error);
        }

        // Fallback values
        userName = userName || authUser.username || 'Participant';
        userEmail = userEmail || 'participant@daytradedak.com';
      }

      // Default role is participant (0) unless specified
      const role = dto.role !== undefined ? dto.role : 0;

      // TODO: Add additional validation here to check if user has access to this meeting
      // For example, check if the meeting is associated with an event they registered for
      // or if they have the appropriate subscription level

      // Generate SDK credentials
      const credentials = this.zoomWebSDKService.generateWebSDKCredentials(
        cleanMeetingNumber,
        role,
        userName,
        userEmail,
        dto.password,
      );

      this.logger.log(
        `Generated Zoom Web SDK signature for user ${authUser._id} for meeting ${cleanMeetingNumber}`,
      );

      return {
        success: true,
        credentials,
        message: 'SDK signature generated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to generate Zoom SDK signature', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to generate SDK signature',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validate if a user has access to join a specific meeting
   * This is a placeholder for future implementation
   */
  @Post('validate-access')
  async validateMeetingAccess(
    @Body() body: { meetingNumber: string },
    @Req() req: RequestWithUser,
  ) {
    // TODO: Implement actual access validation logic
    // Check if user has:
    // - Registered for an event with this meeting ID
    // - Active subscription that includes access
    // - Been explicitly invited to this meeting
    
    const cleanMeetingNumber = this.zoomWebSDKService.cleanMeetingNumber(
      body.meetingNumber,
    );

    // For now, return true if meeting number is valid
    const isValid = this.zoomWebSDKService.validateMeetingNumber(cleanMeetingNumber);

    return {
      hasAccess: isValid,
      meetingNumber: cleanMeetingNumber,
      message: isValid 
        ? 'User has access to this meeting' 
        : 'Invalid meeting number',
    };
  }

  private get logger() {
    return this.zoomWebSDKService['logger'];
  }
}