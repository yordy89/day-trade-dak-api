import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { User, UserDocument } from '../users/user.schema';
import { SubscriptionPlan } from '../users/user.dto';
import { Role } from '../schemas/role';
import { ZoomService } from '../videosdk/zoom.service';
import { ZoomApiService } from '../videosdk/zoom-api.service';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ModulePermissionsService } from '../module-permissions/module-permissions.service';
import { ModuleType } from '../module-permissions/module-permission.schema';
import { MeetingAccessTokensService } from './meeting-access-tokens.service';
import { ZoomWebhooksService } from '../zoom-webhooks/zoom-webhooks.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private zoomService: ZoomService,
    private zoomApiService: ZoomApiService,
    private wsGateway: WebSocketGateway,
    private subscriptionsService: SubscriptionsService,
    private modulePermissionsService: ModulePermissionsService,
    private meetingAccessTokensService: MeetingAccessTokensService,
    private zoomWebhooksService: ZoomWebhooksService,
  ) {}

  async getLiveMeetings(userId: string) {
    // Get user with subscriptions
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has access to live meetings
    const hasLiveSubscription = user.subscriptions?.some((sub) => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      return [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
        SubscriptionPlan.MASTER_CLASES,
        SubscriptionPlan.LIVE_RECORDED,
      ].includes(plan as SubscriptionPlan);
    });

    // Check module permissions
    const hasLiveWeeklyModuleAccess =
      await this.modulePermissionsService.hasModuleAccess(
        userId,
        ModuleType.LIVE_WEEKLY,
      );

    const hasAccess =
      hasLiveSubscription ||
      hasLiveWeeklyModuleAccess ||
      user.allowLiveMeetingAccess ||
      user.role === Role.SUPER_ADMIN;

    // Get today's date
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all meetings including recurring ones
    const allMeetings = await this.meetingModel
      .find({
        $or: [
          // Regular meetings scheduled for today
          {
            scheduledAt: {
              $gte: today,
              $lt: tomorrow,
            },
            isRecurring: false,
          },
          // Daily live meeting - always show it regardless of day
          {
            meetingType: 'daily_live',
            isRecurring: true,
          },
          // Other recurring meetings for today
          {
            isRecurring: true,
            recurringDays: todayDayOfWeek,
            meetingType: { $ne: 'daily_live' },
          },
          // Live meetings (host started early) - show regardless of scheduled time
          {
            status: 'live',
          },
        ],
        status: { $ne: 'cancelled' },
      })
      .populate('host', 'firstName lastName email profileImage')
      .populate('participants', 'firstName lastName email profileImage')
      .sort({ meetingType: -1, scheduledAt: 1 }) // Daily live first
      .exec();

    // Process recurring meetings to set today's schedule
    const meetings = allMeetings.map((meeting) => {
      if (meeting.isRecurring && meeting.recurringTime) {
        // Clone the meeting object
        const meetingObj = meeting.toObject();

        // Parse recurring time and set it for today
        const [hours, minutes] = meeting.recurringTime.split(':').map(Number);
        const scheduledAt = new Date();
        scheduledAt.setHours(hours, minutes, 0, 0);

        // For daily live meetings on weekends, show next scheduled date
        if (
          meeting.meetingType === 'daily_live' &&
          !meeting.recurringDays.includes(todayDayOfWeek)
        ) {
          // Find next weekday
          let daysUntilNext = 1;
          let nextDay = new Date();

          while (daysUntilNext <= 7) {
            nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + daysUntilNext);
            const nextDayOfWeek = nextDay.getDay();

            if (meeting.recurringDays.includes(nextDayOfWeek)) {
              nextDay.setHours(hours, minutes, 0, 0);
              return {
                ...meetingObj,
                scheduledAt: nextDay,
                isScheduledForToday: false,
                status: meetingObj.status || 'upcoming', // Include actual status
              };
            }
            daysUntilNext++;
          }
        }

        return {
          ...meetingObj,
          scheduledAt,
          isScheduledForToday: meeting.recurringDays.includes(todayDayOfWeek),
          status: meetingObj.status || 'upcoming', // Include actual status
        };
      }
      const meetingObj = meeting.toObject();
      return {
        ...meetingObj,
        status: meetingObj.status || 'upcoming', // Include actual status
      };
    });

    // Separate daily live meeting from other meetings
    const dailyLiveMeeting = meetings.find(
      (m) => m.meetingType === 'daily_live',
    );
    const otherMeetings = meetings.filter(
      (m) => m.meetingType !== 'daily_live',
    );

    return {
      hasAccess,
      user: {
        hasLiveSubscription,
        hasLiveWeeklyModuleAccess,
        allowLiveMeetingAccess: user.allowLiveMeetingAccess,
        role: user.role,
      },
      dailyLiveMeeting,
      otherMeetings,
      supportInfo: {
        email: 'support@daytradedak.com',
        phone: '+1 (555) 123-4567',
        whatsapp: '+1 (555) 123-4567',
      },
    };
  }

  async getPublicLiveMeetings() {
    // Get today's date
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all meetings including recurring ones (same query as authenticated)
    const allMeetings = await this.meetingModel
      .find({
        $or: [
          // Regular meetings scheduled for today
          {
            scheduledAt: {
              $gte: today,
              $lt: tomorrow,
            },
            isRecurring: false,
          },
          // Daily live meeting - always show it regardless of day
          {
            meetingType: 'daily_live',
            isRecurring: true,
          },
          // Other recurring meetings for today
          {
            isRecurring: true,
            recurringDays: todayDayOfWeek,
            meetingType: { $ne: 'daily_live' },
          },
          // Live meetings (host started early) - show regardless of scheduled time
          {
            status: 'live',
          },
        ],
        status: { $ne: 'cancelled' },
      })
      .populate('host', 'firstName lastName profileImage') // No email for privacy
      .sort({ meetingType: -1, scheduledAt: 1 })
      .exec();

    // Process recurring meetings to set today's schedule (same as authenticated)
    const meetings = allMeetings.map((meeting) => {
      if (meeting.isRecurring && meeting.recurringTime) {
        const meetingObj = meeting.toObject();
        const [hours, minutes] = meeting.recurringTime.split(':').map(Number);
        const scheduledAt = new Date();
        scheduledAt.setHours(hours, minutes, 0, 0);

        // For daily live meetings on weekends, show next scheduled date
        if (
          meeting.meetingType === 'daily_live' &&
          !meeting.recurringDays.includes(todayDayOfWeek)
        ) {
          let daysUntilNext = 1;
          let nextDay = new Date();

          while (daysUntilNext <= 7) {
            nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + daysUntilNext);
            const nextDayOfWeek = nextDay.getDay();

            if (meeting.recurringDays.includes(nextDayOfWeek)) {
              nextDay.setHours(hours, minutes, 0, 0);
              return {
                ...meetingObj,
                scheduledAt: nextDay,
                isScheduledForToday: false,
                status: meetingObj.status || 'upcoming',
              };
            }
            daysUntilNext++;
          }
        }

        return {
          ...meetingObj,
          scheduledAt,
          isScheduledForToday: meeting.recurringDays.includes(todayDayOfWeek),
          status: meetingObj.status || 'upcoming',
        };
      }
      const meetingObj = meeting.toObject();
      return {
        ...meetingObj,
        status: meetingObj.status || 'upcoming',
      };
    });

    // Separate daily live meeting from other meetings
    const dailyLiveMeeting = meetings.find(
      (m) => m.meetingType === 'daily_live',
    );
    const otherMeetings = meetings.filter(
      (m) => m.meetingType !== 'daily_live',
    );

    return {
      hasAccess: false, // Public users don't have access by default
      requiresAuth: true,
      dailyLiveMeeting,
      otherMeetings,
      supportInfo: {
        email: 'support@daytradedak.com',
        phone: '+1 (555) 123-4567',
        whatsapp: '+1 (555) 123-4567',
      },
    };
  }

  async getUserMeetings(
    userId: string,
    params: {
      status?: string;
      page: number;
      limit: number;
    },
  ) {
    const { status, page, limit } = params;

    const query: any = {
      $or: [{ host: userId }, { participants: userId }],
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
      this.meetingModel
        .find(query)
        .populate('host', 'firstName lastName email profileImage')
        .populate('participants', 'firstName lastName email profileImage')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.meetingModel.countDocuments(query),
    ]);

    return {
      meetings,
      total,
      page,
      limit,
    };
  }

  async getMeetingForUser(meetingId: string, userId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', 'firstName lastName email profileImage')
      .populate('participants', 'firstName lastName email profileImage')
      .exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is host or participant
    const isHost = meeting.host._id.toString() === userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p._id.toString() === userId,
    );

    // Check if user has access through other means
    if (!isHost && !isParticipant && !meeting.isPublic) {
      // Check for admin permissions or module permissions
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new ForbiddenException('You do not have access to this meeting');
      }

      // Check if user is super admin
      const isSuperAdmin = user.role === Role.SUPER_ADMIN;

      // Check if user has admin access through module permissions for live meetings
      const hasLiveWeeklyAccess = await this.modulePermissionsService.hasModuleAccess(
        userId,
        ModuleType.LIVE_WEEKLY,
      );

      // Check if user has live subscription
      const hasLiveSubscription = user.subscriptions?.some((sub: any) => {
        const plan = typeof sub === 'string' ? sub : sub.plan;
        return plan?.includes('LIVE_WEEKLY') || plan?.includes('LIVE_CLASS');
      });

      if (!isSuperAdmin && !hasLiveWeeklyAccess && !hasLiveSubscription) {
        throw new ForbiddenException('You do not have access to this meeting');
      }
    }

    return meeting;
  }

  async joinMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is already a participant
    const isParticipant = meeting.participants.some(
      (p: any) => p.toString() === userId,
    );

    if (!isParticipant) {
      // Add user to participants if not already there
      meeting.participants.push(userId as any);
      await meeting.save();
    }

    // Add to attendees if meeting is live
    if (
      meeting.status === 'live' &&
      !meeting.attendees.includes(userId as any)
    ) {
      meeting.attendees.push(userId as any);
      await meeting.save();
    }

    await meeting.populate('host participants');
    return meeting;
  }

  async getMeetingToken(meetingId: string, userId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', 'firstName lastName email');

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Get user details
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check access
    const hostId = meeting.host._id
      ? meeting.host._id.toString()
      : meeting.host.toString();
    const isHost = hostId === userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.toString() === userId || p._id?.toString() === userId,
    );

    // Check if user has super admin role
    const isAdmin = user.role === Role.SUPER_ADMIN;

    // Check if user has live subscription (only weekly subscriptions grant access)
    const hasLiveSubscription = user.subscriptions?.some((sub) => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      return [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
      ].includes(plan as SubscriptionPlan);
    });

    // Check if user has special live meeting access flag
    const hasLiveMeetingAccess = user.allowLiveMeetingAccess;

    // Check if user has module access for LIVE_WEEKLY
    const hasModuleAccess = await this.modulePermissionsService.hasModuleAccess(
      userId,
      ModuleType.LIVE_WEEKLY,
    );

    // Check if meeting has subscription restrictions
    let hasSubscriptionAccess = true;
    if (
      meeting.restrictedToSubscriptions &&
      meeting.allowedSubscriptions &&
      meeting.allowedSubscriptions.length > 0
    ) {
      // Check if user has any of the allowed subscriptions
      hasSubscriptionAccess =
        await this.subscriptionsService.userHasAnySubscription(
          userId,
          meeting.allowedSubscriptions,
        );
      this.logger.log(
        `Subscription check - Required: ${meeting.allowedSubscriptions.join(', ')}, Has Access: ${hasSubscriptionAccess}`,
      );
    }

    this.logger.log(
      `Meeting access check - User: ${userId}, Host: ${hostId}, IsHost: ${isHost}, IsAdmin: ${isAdmin}, HasLiveSubscription: ${hasLiveSubscription}, HasModuleAccess: ${hasModuleAccess}, HasLiveMeetingAccess: ${hasLiveMeetingAccess}, HasSubscriptionAccess: ${hasSubscriptionAccess}`,
    );

    // Determine if user has access
    // Super admins and hosts always have access
    // Module access should grant access regardless of subscription restrictions
    // For restricted meetings, user must have required subscription OR module access
    // For non-restricted meetings, user needs subscription OR module access OR special flag
    const hasAccess =
      isHost ||
      isAdmin ||
      hasModuleAccess ||
      hasLiveMeetingAccess ||
      (meeting.restrictedToSubscriptions
        ? hasSubscriptionAccess
        : isParticipant ||
          hasLiveSubscription ||
          meeting.isPublic);

    if (!hasAccess) {
      if (
        meeting.restrictedToSubscriptions &&
        meeting.allowedSubscriptions &&
        meeting.allowedSubscriptions.length > 0
      ) {
        throw new ForbiddenException(
          `You need one of the following subscriptions to access this meeting: ${meeting.allowedSubscriptions.join(', ')}`,
        );
      } else {
        throw new ForbiddenException(
          'You do not have access to this meeting. You need a Live Weekly subscription, Live Weekly module permission, or special access.',
        );
      }
    }

    // If user has access but is not a participant yet, add them
    if (!isHost && !isParticipant && hasAccess) {
      meeting.participants.push(userId as any);
      await meeting.save();
      this.logger.log(`Added user ${userId} to meeting participants`);
    }

    // Add to attendees if meeting is live
    if (
      meeting.status === 'live' &&
      !meeting.attendees.some((a: any) => a.toString() === userId)
    ) {
      meeting.attendees.push(userId as any);
      await meeting.save();
      this.logger.log(`Added user ${userId} to meeting attendees`);
    }

    // Generate meeting access based on provider
    const participantName =
      `${user.firstName} ${user.lastName}`.trim() || user.email;
    this.logger.log(
      `Generating meeting access for ${participantName} (${user.email}) as ${isHost ? 'host' : 'participant'}`,
    );

    // Check provider and generate appropriate response
    const provider = meeting.provider || 'zoom';
    
    switch (provider) {
      case 'livekit':
        // For LiveKit meetings, the token will be generated by the LiveKit service
        // Return minimal info here, the frontend will call the LiveKit token endpoint
        this.logger.log(
          `LiveKit meeting ${meeting._id} - Token will be generated by LiveKit service`,
        );
        return {
          token: '', // LiveKit token generated separately
          roomId: meeting.meetingId,
          role: isHost ? 'host' : 'participant',
          provider: 'livekit',
          livekitRoomName: meeting.livekitRoomName,
          useLiveKit: true,
        };
        
      case 'videosdk':
        // For VideoSDK meetings (if still used)
        this.logger.log(
          `VideoSDK meeting ${meeting._id} for ${participantName}`,
        );
        // Add VideoSDK token generation logic here if needed
        return {
          token: '', // VideoSDK token would be generated here
          roomId: meeting.meetingId,
          role: isHost ? 'host' : 'participant',
          provider: 'videosdk',
          useVideoSDK: true,
        };
        
      case 'zoom':
      default:
        // Check if meeting has Zoom details
        if (!meeting.zoomMeetingId || !meeting.zoomJoinUrl) {
          throw new ForbiddenException(
            'Zoom meeting not properly configured. Please contact support.',
          );
        }

        // Use the stored Zoom URL for participants
        let zoomUrl = meeting.zoomJoinUrl;

        // For hosts, use the start URL if available
        if (isHost && meeting.zoomStartUrl) {
          zoomUrl = meeting.zoomStartUrl;
          // The start URL contains the ZAK token which allows starting without login
          this.logger.log('Using start URL with ZAK token for host');
        }

        this.logger.log(
          `Using Zoom meeting ${meeting.zoomMeetingId} for ${participantName}`,
        );

        return {
          token: '', // No token needed for Zoom
          roomId: meeting.meetingId,
          role: isHost ? 'host' : 'participant',
          zoomUrl,
          zoomMeetingId: meeting.zoomMeetingId,
          zoomPassword: meeting.zoomPassword,
          useZoom: true,
          provider: 'zoom',
        };
    }
  }

  async leaveMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', '_id');

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is the host
    const hostId = meeting.host._id
      ? meeting.host._id.toString()
      : meeting.host.toString();
    const isHost = hostId === userId;

    this.logger.log(
      `User ${userId} leaving meeting ${meetingId}. Is host: ${isHost}`,
    );

    // If host is leaving, end the meeting
    if (isHost && meeting.status === 'live') {
      meeting.status = 'completed';
      meeting.endedAt = new Date();
      await meeting.save();
      this.logger.log(`Meeting ${meetingId} ended by host`);

      // Emit WebSocket event for meeting ended
      await this.wsGateway.emitMeetingEnded(meetingId);
      await this.wsGateway.emitMeetingStatusUpdate(meetingId, 'completed');
    } else {
      // If participant is leaving, just remove them from attendees
      meeting.attendees = meeting.attendees.filter(
        (attendee: any) => attendee.toString() !== userId,
      );
      await meeting.save();
      this.logger.log(`Participant ${userId} left meeting ${meetingId}`);
    }

    return {
      message: isHost ? 'Meeting ended' : 'Left meeting',
      meeting: {
        _id: meeting._id,
        status: meeting.status,
        endedAt: meeting.endedAt,
      },
    };
  }

  /**
   * Join meeting with secure token
   */
  async secureJoinWithToken(token: string) {
    const { meeting, userId, role } = await this.meetingAccessTokensService.validateAccessToken(token);
    
    // Get user details
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    
    // Get appropriate Zoom URL
    const isHost = role === 'host';
    const zoomUrl = isHost && meeting.zoomStartUrl 
      ? meeting.zoomStartUrl 
      : meeting.zoomJoinUrl;
    
    // Return redirect response
    return {
      statusCode: 302,
      url: zoomUrl,
      headers: {
        Location: zoomUrl,
      },
    };
  }

  /**
   * Generate time-limited access link
   */
  async generateAccessLink(
    meetingId: string,
    userId: string,
    expiresInMinutes: number = 5,
    singleUse: boolean = true,
  ) {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    
    // Check if user has access to the meeting
    const user = await this.userModel.findById(userId);
    const isHost = meeting.host.toString() === userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.toString() === userId,
    );
    
    if (!isHost && !isParticipant && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    
    const role = isHost ? 'host' : 'participant';
    
    return this.meetingAccessTokensService.generateAccessLink(
      meetingId,
      userId,
      role,
      expiresInMinutes,
      singleUse,
    );
  }

  /**
   * Lock meeting to prevent new participants
   */
  async lockMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    
    // Only host can lock meeting
    const isHost = meeting.host.toString() === userId;
    const user = await this.userModel.findById(userId);
    
    if (!isHost && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only the host can lock the meeting');
    }
    
    if (!meeting.zoomMeetingId) {
      throw new BadRequestException('Meeting does not have a Zoom meeting ID');
    }
    
    // Lock the Zoom meeting
    await this.zoomWebhooksService.lockMeeting(meeting.zoomMeetingId);
    
    // Update meeting status
    meeting.isLocked = true;
    await meeting.save();
    
    return {
      message: 'Meeting locked successfully',
      meetingId: meeting._id,
      isLocked: true,
    };
  }

  async debugEndMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel.findById(meetingId);
    
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if user is authorized (host or admin)
    const user = await this.userModel.findById(userId);
    if (!user || (user.role !== Role.SUPER_ADMIN && meeting.host.toString() !== userId)) {
      throw new ForbiddenException('Not authorized to end this meeting');
    }

    // Update meeting status
    meeting.status = 'completed';
    meeting.endedAt = new Date();
    await meeting.save();

    // Emit WebSocket events
    await this.wsGateway.emitMeetingStatusUpdate(meetingId, 'completed');
    await this.wsGateway.emitMeetingEnded(meetingId);

    this.logger.log(`Debug: Meeting ${meetingId} ended via debug endpoint`);

    return {
      success: true,
      message: 'Meeting ended and WebSocket events emitted',
      meetingId,
      status: 'completed',
    };
  }

  /**
   * Check if a user can join a meeting based on their subscriptions and permissions
   */
  async canUserJoinMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', '_id firstName lastName');

    if (!meeting) {
      return {
        canJoin: false,
        reason: 'Meeting not found',
      };
    }

    // Get user details
    const user = await this.userModel.findById(userId);
    if (!user) {
      return {
        canJoin: false,
        reason: 'User not found',
      };
    }

    // Check access
    const hostId = meeting.host._id
      ? meeting.host._id.toString()
      : meeting.host.toString();
    const isHost = hostId === userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.toString() === userId || p._id?.toString() === userId,
    );

    // Check if user has super admin role
    const isAdmin = user.role === Role.SUPER_ADMIN;

    // Check if user has live subscription (only weekly subscriptions grant access)
    const hasLiveSubscription = user.subscriptions?.some((sub) => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      return [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
      ].includes(plan as SubscriptionPlan);
    });

    // Check if user has special live meeting access flag
    const hasLiveMeetingAccess = user.allowLiveMeetingAccess;

    // Check if user has module access for LIVE_WEEKLY
    const hasModuleAccess = await this.modulePermissionsService.hasModuleAccess(
      userId,
      ModuleType.LIVE_WEEKLY,
    );
    
    this.logger.log(`User ${userId} - Module Access Check: ${hasModuleAccess}, Live Subscription: ${hasLiveSubscription}, Special Access: ${hasLiveMeetingAccess}`);

    // Check if meeting has subscription restrictions
    let hasSubscriptionAccess = true;
    if (
      meeting.restrictedToSubscriptions &&
      meeting.allowedSubscriptions &&
      meeting.allowedSubscriptions.length > 0
    ) {
      // Check if user has any of the allowed subscriptions
      hasSubscriptionAccess =
        await this.subscriptionsService.userHasAnySubscription(
          userId,
          meeting.allowedSubscriptions,
        );
    }

    // Determine if user has access
    // User has access if they are:
    // - The host
    // - A super admin
    // - Have module access (takes precedence over subscription restrictions)
    // - Have the required subscription (if meeting is restricted)
    // - A participant OR have live subscription OR have special access OR meeting is public
    const hasAccess =
      isHost ||
      isAdmin ||
      hasModuleAccess ||
      hasLiveMeetingAccess ||
      (meeting.restrictedToSubscriptions
        ? hasSubscriptionAccess
        : isParticipant ||
          hasLiveSubscription ||
          meeting.isPublic);

    if (!hasAccess) {
      let reason = 'You do not have access to this meeting.';
      
      if (
        meeting.restrictedToSubscriptions &&
        meeting.allowedSubscriptions &&
        meeting.allowedSubscriptions.length > 0
      ) {
        reason = `You need one of the following subscriptions to access this meeting: ${meeting.allowedSubscriptions.join(', ')}`;
      } else if (!hasLiveSubscription && !hasModuleAccess && !hasLiveMeetingAccess) {
        reason = 'You need one of the following subscriptions to access this meeting: LiveWeeklyManual, LiveWeeklyRecurring';
      }

      return {
        canJoin: false,
        reason,
      };
    }

    return {
      canJoin: true,
      reason: null,
      role: isHost ? 'host' : 'participant',
    };
  }
}
