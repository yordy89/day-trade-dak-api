import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { LiveKitService } from './livekit.service';
import { CreateLiveKitRoomDto } from './dto/create-livekit-room.dto';
import { JoinLiveKitRoomDto } from './dto/join-livekit-room.dto';
import { LiveKitWebhookDto } from './dto/livekit-webhook.dto';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('livekit')
@Controller('livekit')
export class LiveKitController {
  private readonly logger = new Logger(LiveKitController.name);

  constructor(private readonly livekitService: LiveKitService) {}

  @Post('rooms/:meetingId/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a LiveKit room for a meeting' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  async createRoom(
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateLiveKitRoomDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Creating LiveKit room for meeting ${meetingId} by user ${user._id}`);
    dto.meetingId = meetingId; // Ensure meeting ID is set
    return await this.livekitService.createRoom(dto);
  }

  @Post('rooms/:meetingId/token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get access token to join a LiveKit room' })
  @ApiResponse({ status: 200, description: 'Token generated successfully' })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  async getToken(
    @Param('meetingId') meetingId: string,
    @Body() dto: JoinLiveKitRoomDto,
    @CurrentUser() user: any,
  ) {
    // Use user ID as identity if not provided
    if (!dto.identity) {
      dto.identity = user._id.toString();
    }
    
    // Use user name if not provided
    if (!dto.name) {
      dto.name = `${user.firstName} ${user.lastName}`;
    }

    // Check if user is the meeting host
    const meeting = await this.livekitService.getMeetingById(meetingId);
    const isHost = meeting.host._id?.toString() === user._id.toString() || 
                   meeting.host.toString() === user._id.toString();
    
    // Check if user has access to live meetings
    const hasLiveSubscription = user.subscriptions?.some((sub: any) => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      const isValidPlan = plan === 'LIVE_WEEKLY_MANUAL' || 
                          plan === 'LIVE_WEEKLY_RECURRING' || 
                          plan === 'LiveWeeklyManual' || 
                          plan === 'LiveWeeklyRecurring';
      
      // Check both expiresAt and currentPeriodEnd for expiration
      const expirationDate = sub.currentPeriodEnd || sub.expiresAt;
      const isNotExpired = !expirationDate || new Date(expirationDate) > new Date();
      const isActive = !sub.status || sub.status === 'active';
      
      console.log(`LiveKit Access Check - Plan: ${plan}, Valid: ${isValidPlan}, Not Expired: ${isNotExpired}, Active: ${isActive}, CurrentPeriodEnd: ${sub.currentPeriodEnd}, ExpiresAt: ${sub.expiresAt}`);
      
      return isValidPlan && isNotExpired && isActive;
    });
    
    const hasLivePermission = user.allowLiveMeetingAccess === true;
    const hasLiveWeeklyAccess = user.allowLiveWeeklyAccess === true;

    const hasModulePermission = user.modulePermissions?.some((perm: any) =>
      perm.module === 'LIVE_WEEKLY' &&
      perm.hasAccess === true &&
      (!perm.expiresAt || new Date(perm.expiresAt) > new Date())
    );

    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    // Check if user has any form of live access
    const hasLiveAccess = hasLiveSubscription || hasLivePermission || hasLiveWeeklyAccess || hasModulePermission || isSuperAdmin;
    
    // If not host and no live access, deny token generation
    if (!isHost && !hasLiveAccess) {
      throw new HttpException(
        'You do not have access to live meetings. Please purchase a Live subscription or contact support.',
        HttpStatus.FORBIDDEN
      );
    }
    
    // Set permissions in dto if not already set
    if (dto.canPublish === undefined) {
      // Host, super admin, or users with live access can publish
      dto.canPublish = isHost || isSuperAdmin || hasLiveAccess;
    }
    if (dto.canSubscribe === undefined) {
      dto.canSubscribe = true; // Everyone can watch/listen
    }
    if (dto.canPublishData === undefined) {
      dto.canPublishData = true; // Everyone can chat
    }
    
    this.logger.log(`Token permissions for ${user.email}: isHost=${isHost}, canPublish=${dto.canPublish}, hasLiveAccess=${hasLiveAccess}`);

    const token = await this.livekitService.generateToken(meetingId, dto);
    
    return {
      token,
      url: this.livekitService.getConnectionInfo().wsUrl,
    };
  }

  @Get('rooms/:meetingId/info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get LiveKit room information' })
  @ApiResponse({ status: 200, description: 'Room info retrieved' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getRoomInfo(@Param('meetingId') meetingId: string) {
    return await this.livekitService.getRoomInfo(meetingId);
  }

  @Get('rooms/:meetingId/participants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List participants in a LiveKit room' })
  @ApiResponse({ status: 200, description: 'Participants listed' })
  async listParticipants(@Param('meetingId') meetingId: string) {
    return await this.livekitService.listParticipants(meetingId);
  }

  @Delete('rooms/:meetingId/participants/:participantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a participant from LiveKit room' })
  @ApiResponse({ status: 204, description: 'Participant removed' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeParticipant(
    @Param('meetingId') meetingId: string,
    @Param('participantId') participantId: string,
  ) {
    await this.livekitService.removeParticipant(meetingId, participantId);
  }

  @Delete('rooms/:meetingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a LiveKit room' })
  @ApiResponse({ status: 204, description: 'Room deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(@Param('meetingId') meetingId: string) {
    await this.livekitService.deleteRoom(meetingId);
  }

  @Post('rooms/:meetingId/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start meeting by host' })
  @ApiResponse({ status: 200, description: 'Meeting started successfully' })
  @ApiResponse({ status: 403, description: 'Only host can start meeting' })
  async startMeeting(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: any,
  ) {
    await this.livekitService.startMeetingByHost(meetingId, user._id);
    return { success: true, message: 'Meeting started' };
  }

  @Post('rooms/:meetingId/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End meeting by host' })
  @ApiResponse({ status: 200, description: 'Meeting ended successfully' })
  @ApiResponse({ status: 403, description: 'Only host can end meeting' })
  async endMeeting(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: any,
  ) {
    await this.livekitService.endMeetingByHost(meetingId, user._id);
    return { success: true, message: 'Meeting ended' };
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle LiveKit webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(@Body() webhook: LiveKitWebhookDto) {
    this.logger.log(`Received LiveKit webhook: ${webhook.event}`);
    await this.livekitService.handleWebhook(webhook);
    return { received: true };
  }

  @Get('connection-info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get LiveKit connection information' })
  @ApiResponse({ status: 200, description: 'Connection info' })
  getConnectionInfo() {
    return this.livekitService.getConnectionInfo();
  }

  @Post('rooms/:meetingId/recording/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start recording a LiveKit room' })
  @ApiResponse({ status: 200, description: 'Recording started' })
  @ApiResponse({ status: 403, description: 'Only host can start recording' })
  async startRecording(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: any,
  ) {
    return await this.livekitService.startRecording(meetingId, user._id);
  }

  @Post('rooms/:meetingId/recording/stop')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stop recording a LiveKit room' })
  @ApiResponse({ status: 200, description: 'Recording stopped' })
  @ApiResponse({ status: 403, description: 'Only host can stop recording' })
  async stopRecording(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: any,
  ) {
    return await this.livekitService.stopRecording(meetingId, user._id);
  }
}