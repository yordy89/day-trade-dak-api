import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { User, UserDocument } from '../users/user.schema';
import { SubscriptionPlan } from '../users/user.dto';
import { Role } from '../schemas/role';
import { VideoSDKService } from '../videosdk/videosdk.service';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private videoSDKService: VideoSDKService,
    private wsGateway: WebSocketGateway,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async getLiveMeetings(userId: string) {
    // Get user with subscriptions
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has access to live meetings
    const hasLiveSubscription = user.subscriptions?.some(sub => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      return [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
        SubscriptionPlan.MASTER_CLASES,
        SubscriptionPlan.LIVE_RECORDED,
      ].includes(plan as SubscriptionPlan);
    });

    const hasAccess = hasLiveSubscription || user.allowLiveMeetingAccess || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

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
        ],
        status: { $ne: 'cancelled' },
      })
      .populate('host', 'firstName lastName email profileImage')
      .populate('participants', 'firstName lastName email profileImage')
      .sort({ meetingType: -1, scheduledAt: 1 }) // Daily live first
      .exec();

    // Process recurring meetings to set today's schedule
    const meetings = allMeetings.map(meeting => {
      if (meeting.isRecurring && meeting.recurringTime) {
        // Clone the meeting object
        const meetingObj = meeting.toObject();
        
        // Parse recurring time and set it for today
        const [hours, minutes] = meeting.recurringTime.split(':').map(Number);
        const scheduledAt = new Date();
        scheduledAt.setHours(hours, minutes, 0, 0);
        
        // For daily live meetings on weekends, show next scheduled date
        if (meeting.meetingType === 'daily_live' && !meeting.recurringDays.includes(todayDayOfWeek)) {
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
              };
            }
            daysUntilNext++;
          }
        }
        
        return {
          ...meetingObj,
          scheduledAt,
          isScheduledForToday: meeting.recurringDays.includes(todayDayOfWeek),
        };
      }
      return meeting.toObject();
    });

    // Separate daily live meeting from other meetings
    const dailyLiveMeeting = meetings.find(m => m.meetingType === 'daily_live');
    const otherMeetings = meetings.filter(m => m.meetingType !== 'daily_live');

    return {
      hasAccess,
      user: {
        hasLiveSubscription,
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

  async getUserMeetings(userId: string, params: {
    status?: string;
    page: number;
    limit: number;
  }) {
    const { status, page, limit } = params;

    const query: any = {
      $or: [
        { host: userId },
        { participants: userId },
      ],
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
      (p: any) => p._id.toString() === userId
    );

    if (!isHost && !isParticipant && !meeting.isPublic) {
      throw new ForbiddenException('You do not have access to this meeting');
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
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      // Add user to participants if not already there
      meeting.participants.push(userId as any);
      await meeting.save();
    }

    // Add to attendees if meeting is live
    if (meeting.status === 'live' && !meeting.attendees.includes(userId as any)) {
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
    const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();
    const isHost = hostId === userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.toString() === userId || p._id?.toString() === userId
    );
    
    // Check if user has admin role
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    
    // Check if user has live subscription
    const hasLiveSubscription = user.subscriptions?.some(sub => {
      const plan = typeof sub === 'string' ? sub : sub.plan;
      return [
        SubscriptionPlan.LIVE_WEEKLY_MANUAL,
        SubscriptionPlan.LIVE_WEEKLY_RECURRING,
        SubscriptionPlan.MASTER_CLASES,
        SubscriptionPlan.LIVE_RECORDED,
      ].includes(plan as SubscriptionPlan);
    });
    
    // Check if user has special live meeting access flag
    const hasLiveMeetingAccess = user.allowLiveMeetingAccess;
    
    // Check if meeting has subscription restrictions
    let hasSubscriptionAccess = true;
    if (meeting.restrictedToSubscriptions && meeting.allowedSubscriptions && meeting.allowedSubscriptions.length > 0) {
      // Check if user has any of the allowed subscriptions
      hasSubscriptionAccess = await this.subscriptionsService.userHasAnySubscription(userId, meeting.allowedSubscriptions);
      this.logger.log(`Subscription check - Required: ${meeting.allowedSubscriptions.join(', ')}, Has Access: ${hasSubscriptionAccess}`);
    }
    
    this.logger.log(`Meeting access check - User: ${userId}, Host: ${hostId}, IsHost: ${isHost}, IsAdmin: ${isAdmin}, HasLiveSubscription: ${hasLiveSubscription}, HasLiveMeetingAccess: ${hasLiveMeetingAccess}, HasSubscriptionAccess: ${hasSubscriptionAccess}`);
    
    // Determine if user has access
    // Admins and hosts always have access
    // For restricted meetings, user must have required subscription
    const hasAccess = isHost || isAdmin || 
      (meeting.restrictedToSubscriptions ? hasSubscriptionAccess : (isParticipant || hasLiveSubscription || hasLiveMeetingAccess || meeting.isPublic));
    
    if (!hasAccess) {
      if (meeting.restrictedToSubscriptions && meeting.allowedSubscriptions && meeting.allowedSubscriptions.length > 0) {
        throw new ForbiddenException(`You need one of the following subscriptions to access this meeting: ${meeting.allowedSubscriptions.join(', ')}`);
      } else {
        throw new ForbiddenException('You do not have access to this meeting. You need a live subscription or special access.');
      }
    }
    
    // If user has access but is not a participant yet, add them
    if (!isHost && !isParticipant && hasAccess) {
      meeting.participants.push(userId as any);
      await meeting.save();
      this.logger.log(`Added user ${userId} to meeting participants`);
    }
    
    // Add to attendees if meeting is live
    if (meeting.status === 'live' && !meeting.attendees.some((a: any) => a.toString() === userId)) {
      meeting.attendees.push(userId as any);
      await meeting.save();
      this.logger.log(`Added user ${userId} to meeting attendees`);
    }
    
    // Generate proper VideoSDK token
    const participantName = `${user.firstName} ${user.lastName}`.trim() || user.email;
    this.logger.log(`Generating token for ${participantName} (${user.email}) as ${isHost ? 'host' : 'participant'}`);
    
    const token = await this.videoSDKService.generateToken({
      roomId: meeting.meetingId,
      participantId: userId,
      participantName: participantName,
      role: isHost ? 'host' : 'participant',
    });
    
    this.logger.log(`Token generated successfully for meeting ${meeting.meetingId}`);
    
    return {
      token,
      roomId: meeting.meetingId,
      role: isHost ? 'host' : 'participant',
    };
  }

  async leaveMeeting(meetingId: string, userId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', '_id');
      
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    
    // Check if user is the host
    const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();
    const isHost = hostId === userId;
    
    this.logger.log(`User ${userId} leaving meeting ${meetingId}. Is host: ${isHost}`);
    
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
        (attendee: any) => attendee.toString() !== userId
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
}