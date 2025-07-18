import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  VideoSDKService,
  CreateMeetingDto,
  GenerateTokenDto,
} from './videosdk.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { RequestWithUser } from 'src/auth/auth.interfaces';
import { UserService } from '../users/users.service';

@Controller('videosdk')
@UseGuards(JwtAuthGuard)
export class VideoSDKController {
  constructor(
    private readonly videoSDKService: VideoSDKService,
    private readonly userService: UserService,
  ) {}

  /**
   * Create a new meeting
   */
  @Post('meetings')
  async createMeeting(
    @Body() dto: CreateMeetingDto,
    @Req() req: RequestWithUser,
  ) {
    // Add webhook URL if not provided
    if (!dto.webhookUrl) {
      dto.webhookUrl = `${process.env.API_URL}/videosdk/webhook`;
    }

    return this.videoSDKService.createMeeting(dto);
  }

  /**
   * Generate token for a participant
   */
  @Post('tokens')
  async generateToken(
    @Body() dto: GenerateTokenDto,
    @Req() req: RequestWithUser,
  ) {
    // Use authenticated user info if not provided
    const authUser = req.user;
    if (!dto.participantId) {
      dto.participantId = authUser._id || authUser.sub;
    }
    if (!dto.participantName) {
      // Try to get full user details for name
      try {
        const fullUser = await this.userService.findById(authUser._id);
        dto.participantName = fullUser
          ? `${fullUser.firstName} ${fullUser.lastName}`
          : authUser.username || 'Participant';
      } catch {
        dto.participantName = authUser.username || 'Participant';
      }
    }

    const token = await this.videoSDKService.generateToken(dto);
    return { token };
  }

  /**
   * Validate if a room exists
   */
  @Get('rooms/validate/:roomId')
  async validateRoom(@Param('roomId') roomId: string) {
    const isValid = await this.videoSDKService.validateRoom(roomId);
    return { valid: isValid };
  }

  /**
   * Start recording
   */
  @Post('recordings/start')
  async startRecording(@Body() body: { roomId: string; webhookUrl?: string }) {
    const success = await this.videoSDKService.startRecording(
      body.roomId,
      body.webhookUrl || `${process.env.API_URL}/videosdk/webhook/recording`,
    );
    return { success };
  }

  /**
   * Stop recording
   */
  @Post('recordings/stop')
  async stopRecording(@Body() body: { roomId: string }) {
    const success = await this.videoSDKService.stopRecording(body.roomId);
    return { success };
  }

  /**
   * Get recordings for a room
   */
  @Get('recordings/:roomId')
  async getRecordings(@Param('roomId') roomId: string) {
    const recordings = await this.videoSDKService.getRecordings(roomId);
    return { recordings };
  }

  /**
   * Webhook endpoint for VideoSDK events
   */
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Log the webhook event
    console.log('VideoSDK webhook received:', body);

    // Handle different event types
    switch (body.event) {
      case 'session-started':
        // Handle session start
        break;
      case 'session-ended':
        // Handle session end
        break;
      case 'recording-started':
        // Handle recording start
        break;
      case 'recording-stopped':
        // Handle recording stop
        break;
      case 'participant-joined':
        // Handle participant join
        break;
      case 'participant-left':
        // Handle participant leave
        break;
    }

    return { received: true };
  }

  /**
   * Webhook endpoint for recording events
   */
  @Post('webhook/recording')
  async handleRecordingWebhook(@Body() body: any) {
    console.log('VideoSDK recording webhook received:', body);

    // TODO: Save recording information to database
    // TODO: Notify users about recording availability

    return { received: true };
  }
}
