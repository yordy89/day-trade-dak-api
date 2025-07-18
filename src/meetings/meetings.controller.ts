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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RequestWithUser } from '../types/request-with-user.interface';
import { MeetingsService } from './meetings.service';

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('live-meetings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get live meetings for today with access control' })
  async getLiveMeetings(
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.meetingsService.getLiveMeetings(userId);
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
}