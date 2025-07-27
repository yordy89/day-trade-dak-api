import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RequestWithUser } from '../types/request-with-user.interface';
import { MeetingsService } from './meetings.service';
import { ModuleAccessGuard } from '../guards/module-access.guard';
import { RequireModule } from '../decorators/require-module.decorator';
import { ModuleType } from '../module-permissions/module-permission.schema';

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('live-meetings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get live meetings for today with access control' })
  async getLiveMeetings(@Request() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.getLiveMeetings(userId);
  }

  @Get('public/live-meetings')
  @ApiOperation({ summary: 'Get public live meetings information (no auth required)' })
  async getPublicLiveMeetings() {
    return this.meetingsService.getPublicLiveMeetings();
  }

  @Get('my-meetings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get meetings where user is host or participant' })
  async getMyMeetings(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.getUserMeetings(userId, {
      status,
      page: page || 1,
      limit: limit || 50,
    });
  }

  @Get(':meetingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get meeting details' })
  async getMeetingById(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.getMeetingForUser(meetingId, userId);
  }

  @Get(':meetingId/can-join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user can join meeting based on subscriptions' })
  async canJoinMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.canUserJoinMeeting(meetingId, userId);
  }

  @Post(':meetingId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a meeting' })
  async joinMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.joinMeeting(meetingId, userId);
  }

  @Get(':meetingId/token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get meeting token for VideoSDK' })
  async getMeetingToken(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.getMeetingToken(meetingId, userId);
  }

  @Post(':meetingId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a meeting - updates status if host leaves' })
  async leaveMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.leaveMeeting(meetingId, userId);
  }

  @Get('secure-join')
  @ApiOperation({ summary: 'Join meeting with secure token' })
  @ApiResponse({ status: 302, description: 'Redirects to Zoom meeting' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async secureJoin(@Query('token') token: string) {
    return this.meetingsService.secureJoinWithToken(token);
  }

  @Post(':meetingId/generate-access-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate time-limited access link for a meeting' })
  async generateAccessLink(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
    @Body() body: { expiresInMinutes?: number; singleUse?: boolean },
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.generateAccessLink(
      meetingId,
      userId,
      body.expiresInMinutes,
      body.singleUse,
    );
  }

  @Post(':meetingId/lock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lock meeting to prevent new participants' })
  async lockMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.lockMeeting(meetingId, userId);
  }

  // Debug endpoint to test WebSocket
  @Post(':meetingId/debug-end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Debug endpoint to test meeting end WebSocket event' })
  async debugEndMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.debugEndMeeting(meetingId, userId);
  }
}