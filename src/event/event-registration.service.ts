// src/event-registrations/event-registrations.service.ts

import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EventRegistration,
  EventRegistrationDocument,
} from './schemas/eventRegistration.schema';
import { Event, EventDocument } from './schemas/event.schema';
import { User, UserDocument } from '../users/user.schema';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { EmailService } from 'src/email/email.service';
import { StripeService } from '../payments/stripe/stripe.service';

@Injectable()
export class EventRegistrationsService {
  constructor(
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
  ) {}

  async create(createEventRegistrationDto: CreateEventRegistrationDto) {
    const { eventId, email, firstName } = createEventRegistrationDto;

    try {
      await this.validateNotRegistered(eventId, email); // ✅ New line

      const createdRegistration = new this.eventRegistrationModel({
        ...createEventRegistrationDto,
        email: email.toLowerCase(),
      });

      const saved = await createdRegistration.save();

      await this.emailService.sendEventRegistrationTemplate(
        email,
        firstName,
        2,
      );
      return saved;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async validateNotRegistered(eventId: string, email: string) {
    const existing = await this.eventRegistrationModel.findOne({
      eventId,
      email: email.toLowerCase(),
    });

    if (existing) {
      throw new BadRequestException(
        'Ya te has registrado con este correo electrónico.',
      );
    }
  }

  async findByEvent(eventId: string) {
    return this.eventRegistrationModel.find({ eventId }).exec();
  }

  async findEventById(eventId: string): Promise<EventDocument | null> {
    return this.eventModel.findById(eventId).exec();
  }

  async findById(id: string): Promise<EventRegistrationDocument | null> {
    return this.eventRegistrationModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<EventRegistrationDocument[]> {
    return this.eventRegistrationModel
      .find({ email: email.toLowerCase() })
      .exec();
  }

  async findByUserId(userId: string): Promise<EventRegistrationDocument[]> {
    try {
      // First, get the user to find their email
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        return [];
      }
      
      // Find registrations by either userId OR email (to catch older registrations)
      const registrations = await this.eventRegistrationModel
        .find({
          $or: [
            { userId: new Types.ObjectId(userId) },
            { email: user.email.toLowerCase() }
          ]
        })
        .populate('eventId')
        .exec();
      
      return registrations || [];
    } catch (error) {
      console.error('Error finding registrations by userId:', error);
      return [];
    }
  }

  async createAdditionalAttendeesCheckout(
    registrationId: string,
    additionalAdults: number,
    additionalChildren: number,
    paymentMethod: 'card' | 'klarna' | 'afterpay' | 'local_financing',
    baseAmount: number,
  ) {
    // Get the registration
    const registration =
      await this.eventRegistrationModel.findById(registrationId);
    if (!registration) {
      throw new BadRequestException('Registration not found');
    }

    // Calculate fees if using Klarna
    const klarnaFeePercentage = 0.0644;
    const klarnaFee =
      paymentMethod === 'klarna' ? baseAmount * klarnaFeePercentage : 0;
    const totalAmount = baseAmount + klarnaFee;

    // Create checkout session metadata
    const metadata = {
      type: 'event_registration_update',
      updateType: 'add_attendees',
      registrationId: registrationId,
      eventId: registration.eventId.toString(),
      previousAdults:
        registration.additionalInfo?.['additionalAttendees']?.['adults'] || 0,
      previousChildren:
        registration.additionalInfo?.['additionalAttendees']?.['children'] || 0,
      additionalAdults: additionalAdults.toString(),
      additionalChildren: additionalChildren.toString(),
      email: registration.email,
      paymentMethod,
    };

    // Create Stripe checkout session for the additional amount
    const checkoutResponse =
      await this.stripeService.createEventAttendeeCheckoutSession({
        amount: totalAmount,
        metadata,
        email: registration.email,
        paymentMethod,
      });

    return {
      checkoutUrl: checkoutResponse.url,
      sessionId: checkoutResponse.sessionId,
      additionalAmount: totalAmount,
    };
  }

  async updateRegistrationAttendees(
    registrationId: string,
    additionalAdults: number,
    additionalChildren: number,
    amountPaid: number,
    stripeSessionId: string,
  ) {
    const registration = await this.eventRegistrationModel
      .findById(registrationId)
      .populate('eventId');
    if (!registration) {
      throw new BadRequestException('Registration not found');
    }

    // Get current attendees
    const currentAdults =
      registration.additionalInfo?.['additionalAttendees']?.['adults'] || 0;
    const currentChildren =
      registration.additionalInfo?.['additionalAttendees']?.['children'] || 0;

    // Update attendee counts
    const updatedAdditionalInfo = {
      ...registration.additionalInfo,
      additionalAttendees: {
        adults: currentAdults + additionalAdults,
        children: currentChildren + additionalChildren,
        details: [],
      },
      paymentHistory: [
        ...(registration.additionalInfo?.['paymentHistory'] || []),
        {
          date: new Date(),
          amount: amountPaid,
          type: 'add_attendees',
          stripeSessionId,
          attendeesAdded: {
            adults: additionalAdults,
            children: additionalChildren,
          },
        },
      ],
    };

    // Update registration
    await this.eventRegistrationModel.findByIdAndUpdate(
      registrationId,
      {
        additionalInfo: updatedAdditionalInfo,
        amountPaid: (registration.amountPaid || 0) + amountPaid,
      },
      { new: true },
    );

    // Send confirmation email
    const event = registration.eventId as any; // EventDocument
    await this.emailService.sendEventUpdateConfirmation(
      registration.email,
      registration.firstName,
      {
        eventName: event?.title || event?.name || 'Mentoría Presencial',
        eventDate: event?.date,
        additionalAdults,
        additionalChildren,
        totalAmount: amountPaid,
        confirmationNumber: registration._id.toString(),
        paymentMethod: 'card', // This should come from the checkout session if available
        adultPrice: 75,
        childPrice: 48,
      },
    );

    return { success: true };
  }
}
