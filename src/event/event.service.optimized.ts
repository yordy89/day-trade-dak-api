import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventDocument } from './schemas/event.schema';
import { CustomLoggerService } from '../logger/logger.service';
import { CacheService } from '../cache/cache.service';

interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface EventFilters {
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class EventsServiceOptimized {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'event';

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly logger: CustomLoggerService,
    private readonly cache: CacheService,
  ) {
    this.logger.setContext('EventsService');
  }

  async create(createEventDto: CreateEventDto): Promise<EventDocument> {
    const startTime = Date.now();

    try {
      // Validate dates
      if (createEventDto.startDate && createEventDto.endDate) {
        const start = new Date(createEventDto.startDate);
        const end = new Date(createEventDto.endDate);

        if (start >= end) {
          throw new BadRequestException('Start date must be before end date');
        }
      }

      // Check for overlapping events
      const overlapping = await this.checkOverlappingEvents(
        createEventDto.startDate,
        createEventDto.endDate,
      );

      if (overlapping) {
        throw new ConflictException(
          'An event already exists in this time period',
        );
      }

      // Create event
      const createdEvent = new this.eventModel(createEventDto);
      const savedEvent = await createdEvent.save();

      // Invalidate cache
      await this.invalidateCache();

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_create', duration);
      this.logger.logBusinessEvent('event_created', {
        eventId: savedEvent._id,
        title: savedEvent.title,
      });

      return savedEvent;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_create_failed', duration);

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error('Failed to create event', error.stack);
      throw new InternalServerErrorException('Failed to create event');
    }
  }

  async findAll(
    options: PaginationOptions = {},
    filters: EventFilters = {},
  ): Promise<{
    data: EventDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = this.buildCacheKey('list', { ...options, ...filters });

      // Check cache
      const cached = await this.cache.get<{
        data: EventDocument[];
        total: number;
        page: number;
        pages: number;
      }>(cacheKey);
      if (cached) {
        this.logger.debug('Events retrieved from cache');
        return cached;
      }

      // Pagination defaults
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters.startDate) {
        query.startDate = { $gte: filters.startDate };
      }

      if (filters.endDate) {
        query.endDate = { $lte: filters.endDate };
      }

      // Build sort
      const sort: any = {};
      if (options.sort) {
        sort[options.sort] = options.order === 'desc' ? -1 : 1;
      } else {
        sort.startDate = 1; // Default sort by start date ascending
      }

      // Execute queries in parallel
      const [events, total] = await Promise.all([
        this.eventModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.eventModel.countDocuments(query).exec(),
      ]);

      const result = {
        data: events as EventDocument[],
        total,
        page,
        pages: Math.ceil(total / limit),
      };

      // Cache result
      await this.cache.set(cacheKey, result, this.CACHE_TTL);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('events_findAll', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('events_findAll_failed', duration);
      this.logger.error('Failed to retrieve events', error.stack);
      throw new InternalServerErrorException('Failed to retrieve events');
    }
  }

  async findOne(id: string): Promise<EventDocument> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid event ID format');
      }

      // Check cache
      const cacheKey = this.buildCacheKey('detail', { id });
      const cached = await this.cache.get<EventDocument>(cacheKey);
      if (cached) {
        this.logger.debug(`Event ${id} retrieved from cache`);
        return cached;
      }

      // Query database
      const event = await this.eventModel.findById(id).lean().exec();

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Cache result
      await this.cache.set(cacheKey, event, this.CACHE_TTL);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findOne', duration);

      return event as EventDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findOne_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Failed to find event: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve event');
    }
  }

  async update(
    id: string,
    updateEventDto: Partial<CreateEventDto>,
  ): Promise<EventDocument> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid event ID format');
      }

      // Validate dates if provided
      if (updateEventDto.startDate && updateEventDto.endDate) {
        const start = new Date(updateEventDto.startDate);
        const end = new Date(updateEventDto.endDate);

        if (start >= end) {
          throw new BadRequestException('Start date must be before end date');
        }
      }

      // Update event
      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(
          id,
          { $set: updateEventDto },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException('Event not found');
      }

      // Invalidate cache
      await this.invalidateCache(id);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_update', duration);
      this.logger.logBusinessEvent('event_updated', {
        eventId: id,
        updatedFields: Object.keys(updateEventDto),
      });

      return updatedEvent as EventDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_update_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Failed to update event: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to update event');
    }
  }

  async remove(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid event ID format');
      }

      // Delete event
      const result = await this.eventModel.deleteOne({ _id: id }).exec();

      if (result.deletedCount === 0) {
        throw new NotFoundException('Event not found');
      }

      // Invalidate cache
      await this.invalidateCache(id);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_delete', duration);
      this.logger.logBusinessEvent('event_deleted', { eventId: id });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_delete_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Failed to delete event: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to delete event');
    }
  }

  async getUpcomingEvents(limit = 10): Promise<EventDocument[]> {
    const startTime = Date.now();

    try {
      const cacheKey = this.buildCacheKey('upcoming', { limit });

      // Check cache
      const cached = await this.cache.get<EventDocument[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const now = new Date();
      const events = await this.eventModel
        .find({
          startDate: { $gte: now },
          isActive: true,
        })
        .sort({ startDate: 1 })
        .limit(limit)
        .lean()
        .exec();

      // Cache result
      await this.cache.set(cacheKey, events, this.CACHE_TTL);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('events_getUpcoming', duration);

      return events as EventDocument[];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('events_getUpcoming_failed', duration);
      this.logger.error('Failed to get upcoming events', error.stack);
      throw new InternalServerErrorException(
        'Failed to retrieve upcoming events',
      );
    }
  }

  private async checkOverlappingEvents(
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const query: any = {
      $or: [
        // New event starts during existing event
        {
          startDate: { $lte: startDate },
          endDate: { $gte: startDate },
        },
        // New event ends during existing event
        {
          startDate: { $lte: endDate },
          endDate: { $gte: endDate },
        },
        // New event completely contains existing event
        {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
        },
      ],
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const count = await this.eventModel.countDocuments(query).exec();
    return count > 0;
  }

  private buildCacheKey(operation: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as any);

    return CacheService.generateKey(
      this.CACHE_PREFIX,
      operation,
      JSON.stringify(sortedParams),
    );
  }

  async findActiveCommunityEvent(): Promise<EventDocument | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.buildCacheKey('active-community', {});
      
      // Check cache
      const cached = await this.cache.get<EventDocument>(cacheKey);
      if (cached) {
        return cached;
      }

      // First, try to find a featured event (excluding completed status)
      let event = await this.eventModel
        .findOne({
          type: 'community_event',
          isActive: true,
          featuredInCRM: true,
        })
        .lean()
        .exec();

      // If no featured event found, fall back to the first active event by date
      if (!event) {
        event = await this.eventModel
          .findOne({
            type: 'community_event',
            isActive: true,
            date: { $gte: new Date() },
            status: { $ne: 'completed' },
          })
          .sort({ date: 1 })
          .lean()
          .exec();
      }

      if (event) {
        // Cache result
        await this.cache.set(cacheKey, event, 10);
      }

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findActiveCommunity', duration);

      return event as EventDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findActiveCommunity_failed', duration);
      this.logger.error('Failed to find active community event', error.stack);
      throw new InternalServerErrorException('Failed to find active community event');
    }
  }

  async findCommunityEventById(id: string): Promise<EventDocument> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid event ID format');
      }

      const cacheKey = this.buildCacheKey('community-detail', { id });
      
      // Check cache
      const cached = await this.cache.get<EventDocument>(cacheKey);
      if (cached) {
        return cached;
      }

      const event = await this.eventModel
        .findOne({
          _id: id,
          type: 'community_event',
        })
        .lean()
        .exec();

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      // Cache result
      await this.cache.set(cacheKey, event, this.CACHE_TTL);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findCommunityById', duration);

      return event as EventDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findCommunityById_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Failed to find community event: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve community event');
    }
  }

  async findLandingPageEvents(): Promise<EventDocument[]> {
    const startTime = Date.now();
    try {
      const cacheKey = this.buildCacheKey('landing-page', {});
      
      // Check cache
      const cached = await this.cache.get<EventDocument[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Find events that are:
      // - Marked for landing page display
      // - Active
      // - Future dated
      const now = new Date();
      const events = await this.eventModel
        .find({
          showInLandingPage: true,
          isActive: true,
          date: { $gte: now },
        })
        .sort({ date: 1 }) // Sort by date ascending
        .lean()
        .exec();

      // Cache result
      await this.cache.set(cacheKey, events, this.CACHE_TTL);

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findLandingPage', duration);

      return events as EventDocument[];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('event_findLandingPage_failed', duration);

      this.logger.error('Failed to retrieve landing page events', error.stack);
      throw new InternalServerErrorException('Failed to retrieve landing page events');
    }
  }

  private async invalidateCache(eventId?: string): Promise<void> {
    try {
      // Invalidate all list caches
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:list:*`);
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:upcoming:*`);
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:active-community:*`);
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:community-detail:*`);
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:landing-page:*`);

      // Invalidate specific event cache if ID provided
      if (eventId) {
        const detailKey = this.buildCacheKey('detail', { id: eventId });
        await this.cache.del(detailKey);
        const communityDetailKey = this.buildCacheKey('community-detail', { id: eventId });
        await this.cache.del(communityDetailKey);
      }

      this.logger.debug('Event cache invalidated');
    } catch (error) {
      this.logger.error('Failed to invalidate cache', error.stack);
    }
  }
}
