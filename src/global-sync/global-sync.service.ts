import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../event/schemas/event.schema';
import { EventRegistration, EventRegistrationDocument } from '../event/schemas/eventRegistration.schema';
import { Types } from 'mongoose';
import { EmailService } from '../email/email.service';

export interface EventPayload {
  globalId: string;
  name: string;
  title?: string;
  description?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  type: string;
  location?: string;
  bannerImage?: string;
  duration?: string;
  instructor?: string;
  capacity?: number;
  regionalPricing: {
    regionCode: string;
    currency: string;
    price: number;
    vipPrice?: number;
    stripePriceId?: string;
    stripeVipPriceId?: string;
  }[];
  targetRegions: string[];
  included?: string[];
  notIncluded?: string[];
  metadata?: Record<string, any>;
  contact?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
  };
  status: string;
  showInLandingPage: boolean;
}

export interface RegistrationPayload {
  globalRegistrationId: string;
  globalEventId: string;
  email: string;
  emailHash?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  region: string;
  detectedRegion: string;
  userOverrodeRegion: boolean;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    adset?: string;
    ad?: string;
  };
  additionalInfo?: {
    whatsapp?: string;
    country?: string;
    tradingExperience?: string;
    expectations?: string;
    mediaUsageConsent?: boolean;
    marketingConsent?: boolean;
    [key: string]: any;
  };
  paymentStatus?: string;
  amountPaid?: number;
  currency?: string;
}

@Injectable()
export class GlobalSyncService {
  private readonly logger = new Logger(GlobalSyncService.name);
  private readonly regionCode = 'us';

  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private readonly registrationModel: Model<EventRegistrationDocument>,
    private readonly emailService: EmailService,
  ) {}

  async createEventFromGlobal(payload: EventPayload, version: number): Promise<EventDocument> {
    // Check if we already have this event
    const existing = await this.eventModel.findOne({ globalId: payload.globalId });

    if (existing) {
      // Check version to avoid duplicate processing
      if (existing.globalVersion >= version) {
        this.logger.log(`Event ${payload.globalId} already at version ${existing.globalVersion}, skipping`);
        return existing;
      }
      // Update instead
      return this.updateEventFromGlobal(payload.globalId, payload, version);
    }

    // Get regional pricing for this region
    const pricing = payload.regionalPricing?.find(p => p.regionCode === this.regionCode);

    const eventData = {
      globalId: payload.globalId,
      globalVersion: version,
      isGloballyManaged: true,
      lastSyncedAt: new Date(),
      name: payload.name,
      title: payload.title || payload.name, // Fallback to name if title not provided
      description: payload.description,
      date: new Date(payload.date),
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      type: payload.type,
      location: payload.location,
      bannerImage: payload.bannerImage,
      capacity: payload.capacity || 0,
      price: pricing?.price || 0,
      vipPrice: pricing?.vipPrice || 0,
      included: payload.included || [],
      notIncluded: payload.notIncluded || [],
      metadata: payload.metadata || {},
      contact: payload.contact || {},
      status: payload.status === 'active' ? 'active' : payload.status === 'cancelled' ? 'completed' : 'draft',
      showInLandingPage: payload.showInLandingPage,
      isActive: payload.status === 'active',
    };

    const event = new this.eventModel(eventData);
    const savedEvent = await event.save();

    this.logger.log(`Created local event from global: ${savedEvent.name} (globalId: ${payload.globalId})`);
    return savedEvent;
  }

  async updateEventFromGlobal(globalId: string, payload: EventPayload, version: number): Promise<EventDocument> {
    const existing = await this.eventModel.findOne({ globalId });

    if (!existing) {
      this.logger.warn(`Event with globalId ${globalId} not found, creating new`);
      return this.createEventFromGlobal(payload, version);
    }

    // Check version
    if (existing.globalVersion >= version) {
      this.logger.log(`Event ${globalId} already at version ${existing.globalVersion}, skipping update`);
      return existing;
    }

    // Get regional pricing
    const pricing = payload.regionalPricing?.find(p => p.regionCode === this.regionCode);

    const updateData: any = {
      globalVersion: version,
      lastSyncedAt: new Date(),
      name: payload.name,
      title: payload.title || payload.name, // Fallback to name if title not provided
      description: payload.description,
      date: new Date(payload.date),
      type: payload.type,
      location: payload.location,
      bannerImage: payload.bannerImage,
      capacity: payload.capacity || 0,
      price: pricing?.price || 0,
      vipPrice: pricing?.vipPrice || 0,
      included: payload.included || [],
      notIncluded: payload.notIncluded || [],
      metadata: payload.metadata || {},
      contact: payload.contact || {},
      status: payload.status === 'active' ? 'active' : payload.status === 'cancelled' ? 'completed' : 'draft',
      showInLandingPage: payload.showInLandingPage,
      isActive: payload.status === 'active',
    };

    if (payload.startDate) updateData.startDate = new Date(payload.startDate);
    if (payload.endDate) updateData.endDate = new Date(payload.endDate);

    const updatedEvent = await this.eventModel.findOneAndUpdate(
      { globalId },
      updateData,
      { new: true },
    );

    this.logger.log(`Updated local event from global: ${updatedEvent.name} (globalId: ${globalId}) v${version}`);
    return updatedEvent;
  }

  async cancelEventFromGlobal(globalId: string): Promise<Event | null> {
    const event = await this.eventModel.findOne({ globalId });

    if (!event) {
      this.logger.warn(`Event with globalId ${globalId} not found for cancellation`);
      return null;
    }

    event.status = 'completed';
    event.isActive = false;
    event.lastSyncedAt = new Date();

    await event.save();
    this.logger.log(`Cancelled local event: ${event.name} (globalId: ${globalId})`);
    return event;
  }

  async deleteEventFromGlobal(globalId: string): Promise<boolean> {
    const result = await this.eventModel.deleteOne({ globalId });

    if (result.deletedCount > 0) {
      this.logger.log(`Deleted local event with globalId: ${globalId}`);
      return true;
    }

    this.logger.warn(`Event with globalId ${globalId} not found for deletion`);
    return false;
  }

  async findByGlobalId(globalId: string): Promise<Event | null> {
    return this.eventModel.findOne({ globalId });
  }

  // Registration sync methods
  private generateRegistrationNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REG-${dateStr}-${randomStr}`;
  }

  async createRegistrationFromGlobal(payload: RegistrationPayload): Promise<EventRegistrationDocument> {
    // Check if we already have this registration
    const existing = await this.registrationModel.findOne({
      globalRegistrationId: payload.globalRegistrationId,
    });

    if (existing) {
      this.logger.log(
        `Registration ${payload.globalRegistrationId} already exists, skipping`,
      );
      return existing;
    }

    // Find the local event by globalEventId
    const event = await this.eventModel.findOne({ globalId: payload.globalEventId });

    if (!event) {
      throw new Error(`Event with globalId ${payload.globalEventId} not found in this region`);
    }

    // Determine payment status mapping
    let paymentStatus: 'pending' | 'paid' | 'free' = 'pending';
    if (payload.paymentStatus === 'free') {
      paymentStatus = 'free';
    } else if (payload.paymentStatus === 'completed') {
      paymentStatus = 'paid';
    }

    const registrationData = {
      registrationNumber: this.generateRegistrationNumber(),
      eventId: event._id.toString(),
      globalRegistrationId: payload.globalRegistrationId,
      globalEventId: payload.globalEventId,
      isGloballyManaged: true,
      lastSyncedAt: new Date(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email.toLowerCase(),
      phoneNumber: payload.phoneNumber,
      paymentStatus,
      registrationType: payload.paymentStatus === 'free' ? 'free' : 'paid',
      amountPaid: payload.amountPaid || 0,
      additionalInfo: payload.additionalInfo || {},
    };

    const registration = new this.registrationModel(registrationData);
    const savedRegistration = await registration.save();

    this.logger.log(
      `Created local registration from global: ${savedRegistration.email} for event ${event.name} (globalRegistrationId: ${payload.globalRegistrationId})`,
    );

    // Send confirmation email
    try {
      // Map event type to email template type
      let emailEventType: 'master_course' | 'community_event' | 'vip_event' | 'webinar' | 'seminar' = 'community_event';
      if (event.type === 'master_course') {
        emailEventType = 'master_course';
      } else if (event.type === 'vip_event') {
        emailEventType = 'vip_event';
      } else if (event.type === 'webinar') {
        emailEventType = 'webinar';
      } else if (event.type === 'seminar') {
        emailEventType = 'seminar';
      }

      await this.emailService.sendEventRegistrationEmail(payload.email, {
        firstName: payload.firstName,
        eventName: event.name || event.title,
        eventType: emailEventType,
        eventDate: event.date,
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        eventLocation: event.location,
        eventDescription: event.description,
        ticketNumber: savedRegistration.registrationNumber,
        isPaid: paymentStatus === 'paid' || paymentStatus === 'free',
        amount: payload.amountPaid || 0,
        currency: payload.currency || 'USD',
        additionalInfo: payload.additionalInfo,
      });

      this.logger.log(
        `Sent registration confirmation email to ${payload.email} for event ${event.name}`,
      );
    } catch (emailError) {
      // Log error but don't fail the registration
      this.logger.error(
        `Failed to send confirmation email for registration ${payload.globalRegistrationId}: ${emailError.message}`,
      );
    }

    return savedRegistration;
  }

  async updateRegistrationFromGlobal(
    globalRegistrationId: string,
    payload: RegistrationPayload,
  ): Promise<EventRegistrationDocument | null> {
    const existing = await this.registrationModel.findOne({ globalRegistrationId });

    if (!existing) {
      this.logger.warn(
        `Registration with globalRegistrationId ${globalRegistrationId} not found, creating new`,
      );
      return this.createRegistrationFromGlobal(payload);
    }

    // Determine payment status mapping
    let paymentStatus: 'pending' | 'paid' | 'free' = existing.paymentStatus;
    if (payload.paymentStatus === 'free') {
      paymentStatus = 'free';
    } else if (payload.paymentStatus === 'completed') {
      paymentStatus = 'paid';
    } else if (payload.paymentStatus === 'pending') {
      paymentStatus = 'pending';
    }

    const updateData = {
      lastSyncedAt: new Date(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneNumber: payload.phoneNumber,
      paymentStatus,
      amountPaid: payload.amountPaid || existing.amountPaid,
      additionalInfo: { ...existing.additionalInfo, ...payload.additionalInfo },
    };

    const updatedRegistration = await this.registrationModel.findOneAndUpdate(
      { globalRegistrationId },
      updateData,
      { new: true },
    );

    this.logger.log(
      `Updated local registration from global: ${updatedRegistration.email} (globalRegistrationId: ${globalRegistrationId})`,
    );

    return updatedRegistration;
  }

  async findRegistrationByGlobalId(globalRegistrationId: string): Promise<EventRegistration | null> {
    return this.registrationModel.findOne({ globalRegistrationId });
  }
}
