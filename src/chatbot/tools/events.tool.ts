import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../../event/schemas/event.schema';

export interface EventInfo {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: string;
  price?: number;
  currency?: string;
  isActive: boolean;
  spotsAvailable?: number;
  location?: string;
  isOnline: boolean;
}

export interface EventsToolParams {
  region?: 'us' | 'es';
  upcoming?: boolean;
  type?: string;
  limit?: number;
}

@Injectable()
export class EventsTool {
  private readonly logger = new Logger(EventsTool.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  /**
   * Tool definition for Claude function calling
   */
  static getToolDefinition() {
    return {
      name: 'get_events',
      description:
        'Get information about upcoming events, workshops, webinars, and community events. Use this to answer questions about events, schedules, prices, and availability.',
      input_schema: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            enum: ['us', 'es'],
            description: 'Filter events by region (us or es)',
          },
          upcoming: {
            type: 'boolean',
            description: 'If true, only return upcoming events (future dates)',
            default: true,
          },
          type: {
            type: 'string',
            description:
              'Filter by event type (e.g., community_event, workshop, webinar)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return',
            default: 5,
          },
        },
        required: [],
      },
    };
  }

  /**
   * Execute the events tool
   */
  async execute(params: EventsToolParams): Promise<EventInfo[]> {
    try {
      const { region, upcoming = true, type, limit = 5 } = params;

      const query: any = { isActive: true };

      // Filter by date if upcoming
      if (upcoming) {
        query.date = { $gte: new Date() };
      }

      // Filter by type
      if (type) {
        query.type = type;
      }

      // Filter by region if specified
      // Events may have a region field or be available to all
      if (region) {
        query.$or = [
          { region },
          { region: 'both' },
          { region: { $exists: false } },
        ];
      }

      const events = await this.eventModel
        .find(query)
        .sort({ date: 1 })
        .limit(limit)
        .exec();

      return events.map((event) => this.formatEvent(event, region));
    } catch (error) {
      this.logger.error(`Events tool error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a specific event by ID
   */
  async getEventById(eventId: string): Promise<EventInfo | null> {
    try {
      const event = await this.eventModel.findById(eventId).exec();
      return event ? this.formatEvent(event) : null;
    } catch (error) {
      this.logger.error(`Get event by ID error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the next upcoming community event
   */
  async getNextCommunityEvent(region?: 'us' | 'es'): Promise<EventInfo | null> {
    try {
      const query: any = {
        type: 'community_event',
        isActive: true,
        date: { $gte: new Date() },
      };

      if (region) {
        query.$or = [
          { region },
          { region: 'both' },
          { region: { $exists: false } },
        ];
      }

      const event = await this.eventModel.findOne(query).sort({ date: 1 }).exec();

      return event ? this.formatEvent(event, region) : null;
    } catch (error) {
      this.logger.error(`Get next community event error: ${error.message}`);
      return null;
    }
  }

  /**
   * Format event for response
   */
  private formatEvent(event: EventDocument, region?: 'us' | 'es'): EventInfo {
    // Determine currency and price based on region
    const currency = region === 'us' ? 'USD' : 'EUR';
    const price = region === 'us' ? event['priceUsd'] : event['priceEur'];

    return {
      id: event._id.toString(),
      title: event.title || event['name'],
      description: event['description'] || '',
      date: event.date,
      type: event.type,
      price: price || event['price'],
      currency,
      isActive: event.isActive,
      spotsAvailable: event['spotsAvailable'] || event['maxParticipants'],
      location: event['location'],
      isOnline: event['isOnline'] ?? true,
    };
  }

  /**
   * Format events for chatbot context
   */
  formatForContext(events: EventInfo[]): string {
    if (events.length === 0) {
      return 'No upcoming events found.';
    }

    return events
      .map((event, index) => {
        const dateStr = new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const priceStr = event.price
          ? `${event.currency}${event.price}`
          : 'Free';

        return `
${index + 1}. **${event.title}**
   - Date: ${dateStr}
   - Type: ${event.type}
   - Price: ${priceStr}
   - Location: ${event.isOnline ? 'Online' : event.location || 'TBD'}
   ${event.description ? `- Description: ${event.description.slice(0, 200)}...` : ''}`;
      })
      .join('\n');
  }
}
