import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../../schemas/meeting.schema';
import { User, UserDocument } from '../../users/user.schema';
import { CreateMeetingDto } from '../dto/create-meeting.dto';
import { UpdateMeetingDto } from '../dto/update-meeting.dto';
import { ZoomApiService } from '../../videosdk/zoom-api.service';
import { MeetingCronService } from '../../services/meeting-cron.service';
import {
  addDays,
  addWeeks,
  addMonths,
  setHours,
  setMinutes,
  parseISO,
} from 'date-fns';

@Injectable()
export class AdminMeetingsService {
  private readonly logger = new Logger(AdminMeetingsService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private zoomApiService: ZoomApiService,
    private meetingCronService: MeetingCronService,
  ) {}

  async getMeetings(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    type?: string;
    host?: string;
    dateRange?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page,
      limit,
      search,
      status,
      type,
      host,
      dateRange,
      startDate,
      endDate,
      sortBy = 'scheduledAt',
      sortOrder = 'desc',
    } = params;

    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { meetingId: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Type filter
    if (type && type !== 'all') {
      query.isRecurring = type === 'recurring';
    }

    // Host filter
    if (host && host !== 'all') {
      query.host = host;
    }

    // Date range filters
    if (startDate || endDate || dateRange) {
      query.scheduledAt = {};

      if (startDate) {
        query.scheduledAt.$gte = startDate;
      }

      if (endDate) {
        query.scheduledAt.$lte = endDate;
      }

      // Predefined date ranges
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const tomorrow = addDays(today, 1);

        switch (dateRange) {
          case 'today':
            query.scheduledAt = {
              $gte: today,
              $lt: tomorrow,
            };
            break;
          case 'tomorrow':
            query.scheduledAt = {
              $gte: tomorrow,
              $lt: addDays(tomorrow, 1),
            };
            break;
          case 'thisWeek':
            query.scheduledAt = {
              $gte: today,
              $lt: addWeeks(today, 1),
            };
            break;
          case 'nextWeek':
            query.scheduledAt = {
              $gte: addWeeks(today, 1),
              $lt: addWeeks(today, 2),
            };
            break;
          case 'thisMonth':
            query.scheduledAt = {
              $gte: today,
              $lt: addMonths(today, 1),
            };
            break;
          case 'nextMonth':
            query.scheduledAt = {
              $gte: addMonths(today, 1),
              $lt: addMonths(today, 2),
            };
            break;
        }
      }
    }

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [meetings, total] = await Promise.all([
      this.meetingModel
        .find(query)
        .populate('host', 'firstName lastName email profileImage')
        .populate('participants', 'firstName lastName email profileImage')
        .sort(sort)
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
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMeetingById(meetingId: string) {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('host', 'firstName lastName email profileImage')
      .populate('participants', 'firstName lastName email profileImage')
      .exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async createMeeting(createMeetingDto: CreateMeetingDto, hostId: string) {
    const {
      isRecurring,
      recurringType,
      recurringDays,
      recurringEndDate,
      recurringTime,
      ...meetingData
    } = createMeetingDto;

    // Validate that the host exists
    const hostUser = await this.userModel.findById(hostId);
    if (!hostUser) {
      throw new BadRequestException(
        'Invalid host ID. The specified user does not exist.',
      );
    }

    // Debug log
    console.log('Creating meeting with config:', {
      zoomApiConfigured: this.zoomApiService.isConfigured(),
      hostId: hostId,
      hostName: `${hostUser.firstName} ${hostUser.lastName}`,
    });

    if (isRecurring) {
      // For all recurring meetings (except daily_live which is handled by cron)
      if (meetingData.meetingType === 'daily_live') {
        throw new BadRequestException(
          'Daily live meetings are automatically created by the system at midnight. You cannot manually create them.',
        );
      }
      return this.createRecurringMeetings({
        ...createMeetingDto,
        host: hostId,
      });
    }

    let meetingConfig: any = {
      ...meetingData,
      host: hostId,
      status: 'scheduled',
      isRecurring: false,
      provider: meetingData.provider || 'zoom', // Default to zoom if not specified
    };

    // Check provider and create meeting accordingly
    if (meetingData.provider === 'livekit') {
      // For LiveKit, we create the room when the meeting starts
      // For now, just set up the meeting with a placeholder room name
      const roomName = `meeting_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      meetingConfig = {
        ...meetingConfig,
        meetingId: `livekit-${roomName}`,
        roomUrl: roomName, // Will be used to create the actual room later
        livekitRoomName: roomName,
      };
    } else {
      // Use Zoom (default)
      const zoomMeeting = await this.zoomApiService.createMeeting({
        topic: meetingData.title,
        scheduledAt: new Date(meetingData.scheduledAt),
        duration: meetingData.duration,
        waitingRoom: meetingData.enableWaitingRoom ?? true,
        joinBeforeHost: false,
        muteUponEntry: true,
        recordAutomatically: meetingData.enableRecording ?? false,
      });

      // Construct the complete Zoom URL with password
      let completeZoomUrl = zoomMeeting.joinUrl;
      if (zoomMeeting.password) {
        // Add password to the URL if not already present
        const url = new URL(zoomMeeting.joinUrl);
        if (!url.searchParams.has('pwd')) {
          url.searchParams.set('pwd', zoomMeeting.password);
        }
        completeZoomUrl = url.toString();
      }

      meetingConfig = {
        ...meetingConfig,
        meetingId: `zoom-${zoomMeeting.zoomMeetingId}`,
        roomUrl: completeZoomUrl, // Use the URL with password included
        zoomMeetingId: zoomMeeting.zoomMeetingId,
        zoomJoinUrl: zoomMeeting.joinUrl,
        zoomStartUrl: zoomMeeting.startUrl,
        zoomPassword: zoomMeeting.password,
      };
    }

    // Create single meeting
    const meeting = new this.meetingModel(meetingConfig);

    await meeting.save();
    await meeting.populate('host participants');

    return meeting;
  }

  private async createRecurringMeetings(data: any) {
    const {
      title,
      description,
      duration,
      participants,
      recurringType,
      recurringDays,
      recurringEndDate,
      recurringTime,
      host,
      ...settings
    } = data;

    const meetings = [];
    let currentDate = new Date(data.scheduledAt);
    const endDate = recurringEndDate
      ? new Date(recurringEndDate)
      : addMonths(currentDate, 6); // Default 6 months

    // Parse recurring time (HH:mm format)
    const [hours, minutes] = recurringTime.split(':').map(Number);

    while (currentDate <= endDate) {
      // Set the time for the meeting
      const meetingDate = setMinutes(
        setHours(new Date(currentDate), hours),
        minutes,
      );

      // Check if this day should have a meeting
      let shouldCreateMeeting = false;

      switch (recurringType) {
        case 'daily':
          shouldCreateMeeting = true;
          break;
        case 'weekly':
          shouldCreateMeeting = recurringDays.includes(meetingDate.getDay());
          break;
        case 'monthly':
          // Create on the same day of each month
          shouldCreateMeeting =
            meetingDate.getDate() === new Date(data.scheduledAt).getDate();
          break;
      }

      if (shouldCreateMeeting && meetingDate >= new Date()) {
        let meetingConfig: any = {
          title: `${title} - ${meetingDate.toLocaleDateString()}`,
          description,
          scheduledAt: meetingDate,
          duration,
          participants,
          host,
          status: 'scheduled',
          isRecurring: true,
          recurringType,
          recurringDays,
          recurringEndDate: endDate,
          ...settings,
        };

        // Always use Zoom for each instance
        const zoomMeeting = await this.zoomApiService.createMeeting({
          topic: `${title} - ${meetingDate.toLocaleDateString()}`,
          scheduledAt: meetingDate,
          duration: duration,
          waitingRoom: settings.enableWaitingRoom ?? true,
          joinBeforeHost: false,
          muteUponEntry: true,
          recordAutomatically: settings.enableRecording ?? false,
        });

        // Construct the complete Zoom URL with password
        let completeZoomUrl = zoomMeeting.joinUrl;
        if (zoomMeeting.password) {
          // Add password to the URL if not already present
          const url = new URL(zoomMeeting.joinUrl);
          if (!url.searchParams.has('pwd')) {
            url.searchParams.set('pwd', zoomMeeting.password);
          }
          completeZoomUrl = url.toString();
        }
        
        meetingConfig = {
          ...meetingConfig,
          meetingId: `zoom-${zoomMeeting.zoomMeetingId}`,
          roomUrl: completeZoomUrl, // Use the URL with password included
          zoomMeetingId: zoomMeeting.zoomMeetingId,
          zoomJoinUrl: zoomMeeting.joinUrl,
          zoomStartUrl: zoomMeeting.startUrl,
          zoomPassword: zoomMeeting.password,
        };

        const meeting = new this.meetingModel(meetingConfig);

        await meeting.save();
        meetings.push(meeting);
      }

      // Move to next date
      switch (recurringType) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addDays(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
      }
    }

    // Populate and return the first meeting as representative
    if (meetings.length > 0) {
      await meetings[0].populate('host participants');
      return meetings[0];
    }

    throw new BadRequestException('No meetings were created');
  }

  async updateMeeting(meetingId: string, updateMeetingDto: UpdateMeetingDto) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    Object.assign(meeting, updateMeetingDto);
    await meeting.save();
    await meeting.populate('host participants');

    return meeting;
  }

  async deleteMeeting(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Delete from Zoom if needed
    if (meeting.zoomMeetingId) {
      try {
        await this.zoomApiService.deleteMeeting(meeting.zoomMeetingId);
      } catch (error) {
        // Log error but continue with deletion
        console.error('Failed to delete Zoom meeting:', error);
      }
    }

    await meeting.deleteOne();
  }

  async startMeeting(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check provider
    if (meeting.provider === 'livekit') {
      // For LiveKit, the room is created when starting the meeting
      // The actual room creation is handled by the LiveKit service
      // when users join with their tokens
      meeting.status = 'live';
      meeting.startedAt = new Date();
      await meeting.save();
      await meeting.populate('host participants');
      return meeting;
    } else {
      // Default to Zoom
      // Verify the Zoom meeting exists before starting
      if (!meeting.zoomMeetingId) {
        throw new BadRequestException('Meeting has no Zoom meeting ID');
      }
      
      const meetingExists = await this.zoomApiService.validateMeeting(meeting.zoomMeetingId);
      
      if (!meetingExists) {
        // Meeting doesn't exist in Zoom, create it
        this.logger.warn(`Zoom meeting ${meeting.zoomMeetingId} not found, creating new meeting`);
        const zoomMeeting = await this.zoomApiService.createMeeting({
          topic: meeting.title,
          scheduledAt: meeting.scheduledAt || new Date(),
          duration: meeting.duration || 60,
          waitingRoom: meeting.enableWaitingRoom ?? true,
          joinBeforeHost: false,
          muteUponEntry: true,
          recordAutomatically: meeting.enableRecording ?? false,
        });
        
        // Update meeting with new Zoom details
        meeting.zoomMeetingId = zoomMeeting.zoomMeetingId;
        meeting.zoomJoinUrl = zoomMeeting.joinUrl;
        meeting.zoomStartUrl = zoomMeeting.startUrl;
        meeting.zoomPassword = zoomMeeting.password;
      }

      meeting.status = 'live';
      meeting.startedAt = new Date();
      await meeting.save();
      await meeting.populate('host participants');

      return meeting;
    }
  }

  async endMeeting(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    meeting.status = 'completed';
    meeting.endedAt = new Date();
    await meeting.save();
    await meeting.populate('host participants');

    return meeting;
  }

  async getMeetingStats() {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    const [total, upcoming, inProgress, completed] = await Promise.all([
      this.meetingModel.countDocuments(),
      this.meetingModel.countDocuments({
        status: 'scheduled',
        scheduledAt: { $gte: today },
      }),
      this.meetingModel.countDocuments({ status: 'live' }),
      this.meetingModel.countDocuments({ status: 'completed' }),
    ]);

    return {
      total,
      upcoming,
      inProgress,
      completed,
    };
  }

  async updateDailyMeetingSchedule() {
    // Find the daily live meeting
    const dailyMeeting = await this.meetingModel.findOne({
      meetingType: 'daily_live',
      isRecurring: true,
    });

    if (!dailyMeeting) {
      throw new NotFoundException('No daily live meeting found');
    }

    const today = new Date();
    const dayOfWeek = today.getDay();

    // Check if today is in the recurring days
    if (!dailyMeeting.recurringDays?.includes(dayOfWeek)) {
      throw new BadRequestException('Daily meeting is not scheduled for today');
    }

    // Parse recurring time
    const [hours, minutes] = dailyMeeting.recurringTime!.split(':').map(Number);

    // Set the new scheduled time for today
    const newScheduledAt = new Date();
    newScheduledAt.setHours(hours, minutes, 0, 0);

    // Update the meeting
    dailyMeeting.scheduledAt = newScheduledAt;

    // Reset status to scheduled if it was completed
    if (dailyMeeting.status === 'completed') {
      dailyMeeting.status = 'scheduled';
      dailyMeeting.startedAt = undefined;
      dailyMeeting.endedAt = undefined;
      dailyMeeting.attendees = [];
    }

    await dailyMeeting.save();
    await dailyMeeting.populate('host participants');

    return dailyMeeting;
  }

  async triggerDailyCleanup() {
    // Get counts before cleanup
    const beforeCount = await this.meetingModel.countDocuments();

    // Manually trigger the cron job for cleanup only
    // NOTE: Meeting creation is now handled by Global API
    const cleanupResult =
      await this.meetingCronService.dailyMeetingCleanup();

    // Get counts after cleanup
    const afterCount = await this.meetingModel.countDocuments();

    // Check if daily meeting exists in DB (created by Global API)
    const dailyMeeting = await this.meetingModel
      .findOne({
        meetingType: 'daily_live',
      })
      .sort({ createdAt: -1 });

    return {
      cleanupDetails: cleanupResult,
      deletedMeetingsCount: cleanupResult.totalDeleted,
      meetingsBeforeCleanup: beforeCount,
      meetingsAfterCleanup: afterCount,
      actualDailyMeetingInDB: !!dailyMeeting,
      dailyMeetingId: dailyMeeting?._id,
      dailyMeetingScheduledAt: dailyMeeting?.scheduledAt,
      note: 'Meeting creation is now handled by Global API',
    };
  }
}
