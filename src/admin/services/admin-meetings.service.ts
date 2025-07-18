import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../../schemas/meeting.schema';
import { CreateMeetingDto } from '../dto/create-meeting.dto';
import { UpdateMeetingDto } from '../dto/update-meeting.dto';
import { VideoSDKService } from '../../videosdk/videosdk.service';
import { MeetingCronService } from '../../services/meeting-cron.service';
import { addDays, addWeeks, addMonths, setHours, setMinutes, parseISO } from 'date-fns';

@Injectable()
export class AdminMeetingsService {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private videoSDKService: VideoSDKService,
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
    const { isRecurring, recurringType, recurringDays, recurringEndDate, recurringTime, ...meetingData } = createMeetingDto;

    if (isRecurring) {
      // For all recurring meetings (except daily_live which is handled by cron)
      if (meetingData.meetingType === 'daily_live') {
        throw new BadRequestException('Daily live meetings are automatically created by the system at midnight. You cannot manually create them.');
      }
      return this.createRecurringMeetings({
        ...createMeetingDto,
        host: hostId,
      });
    }

    // Create VideoSDK room
    const room = await this.videoSDKService.createMeeting({
      title: meetingData.title,
      mode: 'CONFERENCE',
    });

    // Create single meeting
    const meeting = new this.meetingModel({
      ...meetingData,
      host: hostId,
      meetingId: room.roomId,
      roomUrl: `https://app.videosdk.live/rooms/${room.roomId}`,
      status: 'scheduled',
      isRecurring: false,
    });

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
    const endDate = recurringEndDate ? new Date(recurringEndDate) : addMonths(currentDate, 6); // Default 6 months

    // Parse recurring time (HH:mm format)
    const [hours, minutes] = recurringTime.split(':').map(Number);

    while (currentDate <= endDate) {
      // Set the time for the meeting
      const meetingDate = setMinutes(setHours(new Date(currentDate), hours), minutes);

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
          shouldCreateMeeting = meetingDate.getDate() === new Date(data.scheduledAt).getDate();
          break;
      }

      if (shouldCreateMeeting && meetingDate >= new Date()) {
        // Create VideoSDK room for each instance
        const room = await this.videoSDKService.createMeeting({
          title: `${title} - ${meetingDate.toLocaleDateString()}`,
          mode: 'CONFERENCE',
        });

        const meeting = new this.meetingModel({
          title: `${title} - ${meetingDate.toLocaleDateString()}`,
          description,
          scheduledAt: meetingDate,
          duration,
          participants,
          host,
          meetingId: room.roomId,
          roomUrl: `https://app.videosdk.live/rooms/${room.roomId}`,
          status: 'scheduled',
          isRecurring: true,
          recurringType,
          recurringDays,
          recurringEndDate: endDate,
          ...settings,
        });

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

    // Delete from VideoSDK if needed
    // await this.videoSDKService.deleteRoom(meeting.meetingId);

    await meeting.deleteOne();
  }

  async startMeeting(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    meeting.status = 'live';
    meeting.startedAt = new Date();
    await meeting.save();
    await meeting.populate('host participants');

    return meeting;
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
    
    // Manually trigger the cron job for testing
    const cleanupResult = await this.meetingCronService.dailyMeetingCleanupAndCreate();
    
    // Get counts after cleanup
    const afterCount = await this.meetingModel.countDocuments();
    
    // Check if daily meeting exists in DB
    const dailyMeeting = await this.meetingModel.findOne({
      meetingType: 'daily_live'
    }).sort({ createdAt: -1 });
    
    return {
      cleanupDetails: cleanupResult,
      deletedMeetingsCount: cleanupResult.totalDeleted,
      dailyMeetingCreated: cleanupResult.meetingCreated,
      dailyMeetingId: cleanupResult.createdMeeting?._id || dailyMeeting?._id,
      dailyMeetingScheduledAt: cleanupResult.createdMeeting?.scheduledAt || dailyMeeting?.scheduledAt,
      meetingsBeforeCleanup: beforeCount,
      meetingsAfterCleanup: afterCount,
      actualDailyMeetingInDB: !!dailyMeeting,
      tomorrow: new Date(new Date().setDate(new Date().getDate() + 1)),
      tomorrowDayOfWeek: new Date(new Date().setDate(new Date().getDate() + 1)).getDay(),
    };
  }
}