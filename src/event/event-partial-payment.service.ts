import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from './schemas/eventRegistration.schema';
import {
  EventPaymentTracker,
  EventPaymentTrackerDocument,
  PaymentStatus,
  PaymentType,
} from './schemas/eventPaymentTracker.schema';
import { User, UserDocument } from '../users/user.schema';
import { InitiatePartialPaymentDto } from './dto/initiate-partial-payment.dto';
import { MakePaymentDto, SearchRegistrationDto } from './dto/make-payment.dto';
import { EmailService } from 'src/email/email.service';
import { StripeService } from '../payments/stripe/stripe.service';
import { LocalFinancingService } from '../payments/local-financing/local-financing.service';
import { InstallmentPlan } from '../payments/local-financing/installment-plan.schema';
import { AffiliateService } from '../affiliate/affiliate.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventPartialPaymentService {
  constructor(
    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    @InjectModel(EventPaymentTracker.name)
    private paymentTrackerModel: Model<EventPaymentTrackerDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(InstallmentPlan.name)
    private installmentPlanModel: Model<InstallmentPlan>,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
    @Inject(forwardRef(() => LocalFinancingService))
    private readonly localFinancingService: LocalFinancingService,
    @Inject(forwardRef(() => AffiliateService))
    private readonly affiliateService: AffiliateService,
  ) {}

  /**
   * Initiate a partial payment registration
   */
  async initiatePartialPayment(dto: InitiatePartialPaymentDto) {
    const { eventId, email, depositAmount } = dto;

    // Get event details
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if partial payments are allowed
    if (event.paymentMode !== 'partial_allowed') {
      throw new BadRequestException('This event requires full payment');
    }

    // Validate deposit amount
    const minimumDeposit = this.calculateMinimumDeposit(event);
    if (depositAmount < minimumDeposit) {
      throw new BadRequestException(
        `Minimum deposit amount is $${minimumDeposit}`,
      );
    }

    // Check if user already registered
    const existingRegistration = await this.eventRegistrationModel.findOne({
      eventId,
      email: email.toLowerCase(),
    });

    if (existingRegistration) {
      const hasNoPayment = (existingRegistration.totalPaid || 0) === 0;

      if (hasNoPayment) {
        // User abandoned checkout - allow immediate replacement
        // Delete the abandoned registration to allow new registration
        console.log('🗑️ Replacing abandoned checkout registration:', existingRegistration._id);
        console.log('📊 Abandoned registration details:', {
          email: existingRegistration.email,
          totalPaid: existingRegistration.totalPaid,
          createdAt: (existingRegistration as any).createdAt,
          checkoutSessionId: existingRegistration.stripeCheckoutSessionId,
        });

        await this.eventRegistrationModel.findByIdAndDelete(existingRegistration._id);

        // Also delete associated payment tracker if exists
        const deletedTrackers = await this.paymentTrackerModel.deleteMany({
          registrationId: existingRegistration._id,
          status: PaymentStatus.PENDING,
        });

        console.log('✅ Deleted abandoned registration and', deletedTrackers.deletedCount, 'pending payment trackers');
      } else {
        // Has payment - block duplicate registration
        throw new BadRequestException(
          'You are already registered for this event. Please use the "My Registration" page to continue your payment.',
        );
      }
    }

    // Calculate amounts with affiliate discount
    const originalPrice = event.price || 0;
    let totalAmount = originalPrice;
    let discountAmount = 0;
    let affiliateData: any = null;

    // Apply affiliate discount if code is provided
    if (dto.affiliateCode) {
      const affiliateValidation = await this.affiliateService.validateCode(
        dto.affiliateCode,
        'master_course'
      );

      if (affiliateValidation.valid) {
        affiliateData = affiliateValidation;

        // Calculate discount based on type
        if (affiliateData.discountType === 'percentage') {
          discountAmount = (originalPrice * (affiliateData.discountPercentage || 0)) / 100;
        } else {
          discountAmount = affiliateData.discountFixedAmount || 0;
        }

        // Apply discount to total amount
        totalAmount = originalPrice - discountAmount;

        console.log('💰 Affiliate discount applied:', {
          code: dto.affiliateCode,
          originalPrice,
          discountAmount,
          finalPrice: totalAmount,
        });
      }
    }

    const remainingBalance = totalAmount - depositAmount;

    // Generate unique registration number
    const registrationNumber = this.generateRegistrationNumber();

    // Calculate checkout session expiration (2 hours from now)
    // This allows the cron job to clean up abandoned checkouts more quickly
    const checkoutExpiresAt = new Date();
    checkoutExpiresAt.setHours(checkoutExpiresAt.getHours() + 2);

    // STEP 1: Create registration first (needed for registration ID in success URL)
    const registration = new this.eventRegistrationModel({
      registrationNumber,
      eventId: dto.eventId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: email.toLowerCase(),
      phoneNumber: dto.phoneNumber,
      userId: dto.userId,
      additionalInfo: dto.additionalInfo,
      // Affiliate/Referral tracking
      affiliateCode: dto.affiliateCode,
      affiliateId: affiliateData?.affiliateId ? new Types.ObjectId(affiliateData.affiliateId) : undefined,
      originalPrice: originalPrice,
      discountAmount: discountAmount,
      finalPrice: totalAmount,
      commissionType: affiliateData?.commissionType,
      commissionRate: affiliateData?.commissionRate,
      commissionFixedAmount: affiliateData?.commissionFixedAmount,
      // Partial payment fields - EXPLICIT
      paymentMode: 'partial',
      paymentStatus: 'pending',
      totalAmount: totalAmount, // This is now the DISCOUNTED price!
      depositPaid: 0,
      totalPaid: 0,
      remainingBalance: totalAmount,
      isFullyPaid: false,
      isVip: false,
      paymentHistory: [],
      // Checkout tracking - allows cleanup of abandoned checkouts
      checkoutSessionExpiresAt: checkoutExpiresAt,
    });

    console.log('💾 Creating registration with data:', {
      paymentMode: registration.paymentMode,
      totalAmount: registration.totalAmount,
      totalPaid: registration.totalPaid,
      remainingBalance: registration.remainingBalance,
    });

    const savedRegistration = await registration.save();

    console.log('💾 Saved registration:', {
      _id: savedRegistration._id,
      paymentMode: savedRegistration.paymentMode,
      totalAmount: savedRegistration.totalAmount,
      totalPaid: savedRegistration.totalPaid,
      remainingBalance: savedRegistration.remainingBalance,
    });

    // Generate payment ID
    const paymentId = uuidv4();

    try {
      // STEP 2: Create Stripe checkout session with registration ID
      const sessionData = {
        eventId: event._id.toString(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        userId: dto.userId?.toString(),
        amount: depositAmount,
        isPartialPayment: true,
        paymentId,
        registrationId: savedRegistration._id.toString(),
        description: `Deposit for ${event.name}`,
        additionalInfo: dto.additionalInfo,
      };

      console.log('🔵 Creating Stripe checkout session with data:', sessionData);

      const checkoutSession = await this.stripeService.createEventCheckoutSession(sessionData);

      console.log('🔵 Stripe response:', checkoutSession);

      // Validate that we got a checkout URL
      if (!checkoutSession || !checkoutSession.url) {
        console.error('❌ No checkout URL in response:', checkoutSession);
        // Rollback: delete the registration
        await this.eventRegistrationModel.findByIdAndDelete(savedRegistration._id);
        throw new BadRequestException('Failed to create Stripe checkout session');
      }

      console.log('✅ Stripe checkout URL created:', checkoutSession.url);

      // Update registration with Stripe checkout session ID
      savedRegistration.stripeCheckoutSessionId = checkoutSession.sessionId;
      await savedRegistration.save();

      // STEP 3: Create payment tracker (linked to Stripe session)
      const paymentTracker = new this.paymentTrackerModel({
        registrationId: savedRegistration._id,
        eventId,
        userId: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
        email: email.toLowerCase(),
        paymentId,
        paymentType: PaymentType.DEPOSIT,
        amount: depositAmount,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        totalEventPrice: totalAmount,
        previousBalance: totalAmount,
        newBalance: remainingBalance,
        description: 'Initial Deposit',
        stripeSessionId: checkoutSession.sessionId,
      });

      await paymentTracker.save();

      // If financing plan requested, create installment plan
      if (dto.createInstallmentPlan && dto.financingPlanId) {
        await this.createInstallmentPlan(
          savedRegistration,
          remainingBalance,
          dto.financingPlanId,
        );
      }

      return {
        registration: savedRegistration,
        paymentTracker,
        url: checkoutSession.url,
        checkoutUrl: checkoutSession.url,
        remainingBalance,
        totalAmount,
        depositAmount,
      };
    } catch (error) {
      // Rollback: delete the registration if Stripe fails
      await this.eventRegistrationModel.findByIdAndDelete(savedRegistration._id);
      throw error;
    }
  }

  /**
   * Make an additional payment on a registration
   */
  async makePayment(registrationId: string, dto: MakePaymentDto) {
    const registration = await this.eventRegistrationModel.findById(
      registrationId,
    );

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.isFullyPaid) {
      throw new BadRequestException('Registration is already fully paid');
    }

    const event = await this.eventModel.findById(registration.eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Ensure payment doesn't exceed remaining balance
    // Round to 2 decimals to avoid floating point precision issues
    const remainingBalance = parseFloat((registration.remainingBalance || 0).toFixed(2));
    const paymentAmount = parseFloat(dto.amount.toFixed(2));
    const minimumPayment = event.minimumInstallmentAmount || 50;

    // BUSINESS RULE:
    // If remaining balance < minimum payment: User MUST pay the exact remaining balance (final payment)
    // If remaining balance >= minimum payment: User can pay any amount from minimum to remaining
    if (remainingBalance < minimumPayment) {
      // Final payment scenario - must pay exact remaining amount
      if (paymentAmount !== remainingBalance) {
        throw new BadRequestException(
          `You must pay the full remaining balance of $${remainingBalance.toFixed(2)} to complete your registration`,
        );
      }
    } else {
      // Regular partial payment scenario - enforce minimum
      if (paymentAmount < minimumPayment) {
        throw new BadRequestException(
          `Minimum payment amount is $${minimumPayment.toFixed(2)}`,
        );
      }

      if (paymentAmount > remainingBalance) {
        throw new BadRequestException(
          `Payment amount exceeds remaining balance of $${remainingBalance.toFixed(2)}`,
        );
      }
    }

    // Generate payment ID first
    const paymentId = uuidv4();

    // STEP 1: Create Stripe checkout session FIRST (before saving tracker)
    const checkoutSession = await this.createPaymentCheckoutSession(
      registration,
      event,
      dto.amount,
      paymentId,
    );

    // Validate checkout URL
    if (!checkoutSession || !checkoutSession.url) {
      throw new BadRequestException('Failed to create Stripe checkout session');
    }

    // STEP 2: Only create payment tracker AFTER Stripe session is confirmed
    const paymentTracker = new this.paymentTrackerModel({
      registrationId: registration._id,
      eventId: registration.eventId,
      userId: registration.userId,
      email: registration.email,
      paymentId,
      paymentType:
        dto.amount >= remainingBalance
          ? PaymentType.FINAL_PAYMENT
          : PaymentType.PARTIAL_PAYMENT,
      amount: dto.amount,
      currency: 'USD',
      status: PaymentStatus.PENDING,
      totalEventPrice: registration.totalAmount,
      previousBalance: remainingBalance,
      newBalance: remainingBalance - dto.amount,
      description: dto.description || 'Payment',
      metadata: dto.metadata,
      stripeSessionId: checkoutSession.sessionId,
    });

    await paymentTracker.save();

    return {
      paymentTracker,
      checkoutUrl: checkoutSession.url,
      url: checkoutSession.url,
      previousBalance: remainingBalance,
      newBalance: remainingBalance - dto.amount,
      paymentAmount: dto.amount,
    };
  }

  /**
   * Process successful payment (called from Stripe webhook)
   */
  async processSuccessfulPayment(
    paymentId: string,
    stripePaymentIntentId: string,
    receiptUrl?: string,
  ) {
    const paymentTracker = await this.paymentTrackerModel.findOne({
      paymentId,
    });

    if (!paymentTracker) {
      throw new NotFoundException('Payment tracker not found');
    }

    // Update payment tracker
    paymentTracker.status = PaymentStatus.COMPLETED;
    paymentTracker.stripePaymentIntentId = stripePaymentIntentId;
    paymentTracker.receiptUrl = receiptUrl;
    paymentTracker.processedAt = new Date();
    await paymentTracker.save();

    // Update registration
    const registration = await this.eventRegistrationModel.findById(
      paymentTracker.registrationId,
    );

    if (registration) {
      console.log('💾 BEFORE Update - Registration:', {
        _id: registration._id,
        totalPaid: registration.totalPaid,
        totalAmount: registration.totalAmount,
        remainingBalance: registration.remainingBalance,
      });

      // Update payment totals
      registration.totalPaid = (registration.totalPaid || 0) + paymentTracker.amount;
      registration.remainingBalance =
        (registration.totalAmount || 0) - (registration.totalPaid || 0);

      console.log('💾 AFTER Calculation - Registration:', {
        totalPaid: registration.totalPaid,
        remainingBalance: registration.remainingBalance,
        paymentAmount: paymentTracker.amount,
      });

      // Check if fully paid
      if (registration.remainingBalance <= 0) {
        registration.isFullyPaid = true;
        registration.paymentStatus = 'paid';
        registration.remainingBalance = 0;
      }

      // Add to payment history
      if (!registration.paymentHistory) {
        registration.paymentHistory = [];
      }

      registration.paymentHistory.push({
        paymentId: paymentTracker.paymentId,
        amount: paymentTracker.amount,
        paymentDate: new Date(),
        paymentMethod: paymentTracker.paymentMethod,
        stripePaymentIntentId,
        description: paymentTracker.description,
        status: 'completed',
        receiptUrl,
      });

      await registration.save();

      console.log('💾 AFTER Save - Registration:', {
        _id: registration._id,
        totalPaid: registration.totalPaid,
        totalAmount: registration.totalAmount,
        remainingBalance: registration.remainingBalance,
        isFullyPaid: registration.isFullyPaid,
      });

      console.log('📧 Sending payment confirmation email...');
      // Send confirmation email (payment summary)
      await this.sendPaymentConfirmationEmail(registration, paymentTracker);
      console.log('✅ Payment confirmation email sent');

      // If fully paid, send completion email (full event details)
      if (registration.isFullyPaid) {
        console.log('🎓 Payment is fully paid! Sending full event registration email...');
        await this.sendPaymentCompletionEmail(registration);
        console.log('✅ Full event registration email sent');

        // Create commission for affiliate if applicable
        if (registration.affiliateCode && registration.affiliateId) {
          try {
            console.log('💰 Creating commission for affiliate:', registration.affiliateCode);
            await this.affiliateService.createCommission({
              affiliateId: registration.affiliateId.toString(),
              affiliateCode: registration.affiliateCode,
              registrationId: registration._id.toString(),
              customerEmail: registration.email,
              customerName: `${registration.firstName} ${registration.lastName}`,
              originalPrice: registration.originalPrice || registration.totalAmount || 0,
              discountAmount: registration.discountAmount || 0,
              finalPrice: registration.finalPrice || registration.totalAmount || 0,
              commissionType: registration.commissionType,
              commissionRate: registration.commissionRate,
              commissionFixedAmount: registration.commissionFixedAmount,
              stripeSessionId: paymentTracker.stripeSessionId,
              paymentMethod: paymentTracker.paymentMethod,
            });
            console.log('✅ Commission created successfully');
          } catch (error) {
            console.error('❌ Error creating commission:', error);
            // Don't throw - payment was successful, commission is secondary
          }
        }
      }
    }

    return { paymentTracker, registration };
  }

  /**
   * Get registration balance and payment history
   */
  async getRegistrationBalance(registrationId: string) {
    const registration = await this.eventRegistrationModel
      .findById(registrationId)
      .populate('eventId');

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const paymentTrackers = await this.paymentTrackerModel
      .find({
        registrationId: registration._id,
      })
      .sort({ createdAt: -1 });

    return {
      registration: {
        id: registration._id,
        registrationNumber: registration.registrationNumber,
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName,
        eventName: (registration.eventId as any)?.name,
        totalAmount: registration.totalAmount,
        totalPaid: registration.totalPaid,
        remainingBalance: registration.remainingBalance,
        isFullyPaid: registration.isFullyPaid,
        paymentMode: registration.paymentMode,
        createdAt: (registration as any).createdAt,
      },
      paymentHistory: paymentTrackers.map((tracker) => ({
        paymentId: tracker.paymentId,
        amount: tracker.amount,
        type: tracker.paymentType,
        status: tracker.status,
        processedAt: tracker.processedAt,
        description: tracker.description,
        receiptUrl: tracker.receiptUrl,
      })),
      summary: {
        totalPayments: paymentTrackers.length,
        totalPaid: registration.totalPaid || 0,
        remainingBalance: registration.remainingBalance || 0,
        isFullyPaid: registration.isFullyPaid,
        nextPaymentDue: registration.nextPaymentDueDate,
      },
    };
  }

  /**
   * Search for registrations
   */
  async searchRegistrations(dto: SearchRegistrationDto) {
    console.log('🔍 Search DTO:', dto);

    const query: any = {};

    if (dto.email) {
      query.email = dto.email.toLowerCase();
    }

    if (dto.phoneNumber) {
      query.phoneNumber = dto.phoneNumber;
    }

    if (dto.registrationId) {
      // Check if it's a valid ObjectId or a registration number
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(dto.registrationId);

      if (isObjectId) {
        // It's a MongoDB _id
        query._id = dto.registrationId;
      } else {
        // It's a registration number
        query.registrationNumber = dto.registrationId.toUpperCase();
      }
    }

    // Filter by event ID if provided (most accurate)
    if (dto.eventId) {
      query.eventId = dto.eventId;
      console.log('🔍 Searching by eventId:', dto.eventId);
    }

    // If filtering by eventType, first get all events of that type
    // NOTE: eventId is stored as a string, not ObjectId, so populate doesn't work
    let eventIdsOfType: string[] = [];
    if (dto.eventType && !dto.eventId) {
      const eventsOfType = await this.eventModel.find({ type: dto.eventType }).select('_id');
      eventIdsOfType = eventsOfType.map(e => e._id.toString());
      console.log('🔍 Found', eventIdsOfType.length, 'events of type:', dto.eventType);

      if (eventIdsOfType.length > 0) {
        query.eventId = { $in: eventIdsOfType };
      } else {
        // No events of this type exist, return empty
        console.log('🔍 No events of type', dto.eventType, 'found');
        return [];
      }
    }

    console.log('🔍 Query:', query);

    const registrations = await this.eventRegistrationModel
      .find(query)
      .sort({ createdAt: -1 });

    console.log('🔍 Found registrations:', registrations.length);

    // Fetch event details for each registration
    const eventIds = [...new Set(registrations.map(reg => reg.eventId))];
    const events = await this.eventModel.find({ _id: { $in: eventIds } });
    const eventMap = new Map(events.map(e => [e._id.toString(), e]));

    const result = registrations.map((reg) => {
      const event = eventMap.get(reg.eventId);
      return {
        id: reg._id,
        registrationNumber: reg.registrationNumber,
        email: reg.email,
        firstName: reg.firstName,
        lastName: reg.lastName,
        phoneNumber: reg.phoneNumber,
        eventId: reg.eventId,
        eventName: event?.name,
        eventDate: event?.date,
        totalAmount: reg.totalAmount,
        totalPaid: reg.totalPaid,
        remainingBalance: reg.remainingBalance,
        isFullyPaid: reg.isFullyPaid,
        paymentMode: reg.paymentMode,
        paymentStatus: reg.paymentStatus,
        createdAt: (reg as any).createdAt,
      };
    });

    console.log('🔍 Returning results:', result.length, 'registrations');
    return result;
  }

  /**
   * Get all partial payment registrations for an event (admin)
   */
  async getEventPartialPayments(eventId: string) {
    const registrations = await this.eventRegistrationModel
      .find({
        eventId,
        paymentMode: 'partial',
      })
      .sort({ createdAt: -1 });

    const results = [];

    for (const registration of registrations) {
      const payments = await this.paymentTrackerModel
        .find({
          registrationId: registration._id,
          status: PaymentStatus.COMPLETED,
        })
        .sort({ createdAt: -1 });

      results.push({
        registration: {
          id: registration._id,
          email: registration.email,
          name: `${registration.firstName} ${registration.lastName}`,
          phoneNumber: registration.phoneNumber,
        },
        payment: {
          totalAmount: registration.totalAmount,
          totalPaid: registration.totalPaid,
          remainingBalance: registration.remainingBalance,
          isFullyPaid: registration.isFullyPaid,
          depositPaid: registration.depositPaid,
          paymentsCount: payments.length,
          lastPaymentDate: payments[0]?.processedAt,
        },
      });
    }

    return {
      total: results.length,
      fullyPaid: results.filter((r) => r.payment.isFullyPaid).length,
      partiallyPaid: results.filter((r) => !r.payment.isFullyPaid).length,
      totalRevenue: results.reduce((sum, r) => sum + (r.payment.totalPaid || 0), 0),
      totalOutstanding: results.reduce(
        (sum, r) => sum + (r.payment.remainingBalance || 0),
        0,
      ),
      registrations: results,
    };
  }

  // Helper methods

  private generateRegistrationNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Generate random alphanumeric code (5 characters)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `REG-${year}${month}${day}-${code}`;
  }

  private calculateMinimumDeposit(event: EventDocument): number {
    if (event.minimumDepositAmount > 0) {
      return event.minimumDepositAmount;
    }

    if (event.depositPercentage > 0) {
      return (event.price * event.depositPercentage) / 100;
    }

    // Default to 20% of total price
    return event.price * 0.2;
  }

  private async createDepositCheckoutSession(
    registration: EventRegistrationDocument,
    event: EventDocument,
    amount: number,
    paymentId: string,
  ) {
    // Create Stripe checkout session for deposit
    const sessionData = {
      eventId: event._id.toString(),
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      phoneNumber: registration.phoneNumber,
      userId: registration.userId?.toString(),
      amount,
      isPartialPayment: true,
      paymentId,
      description: `Deposit for ${event.name}`,
    };

    return await this.stripeService.createEventCheckoutSession(sessionData);
  }

  private async createPaymentCheckoutSession(
    registration: EventRegistrationDocument,
    event: EventDocument,
    amount: number,
    paymentId: string,
  ) {
    // Create Stripe checkout session for additional payment
    const sessionData = {
      eventId: event._id.toString(),
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      phoneNumber: registration.phoneNumber,
      userId: registration.userId?.toString(),
      amount,
      isPartialPayment: true,
      paymentId,
      description: `Payment for ${event.name}`,
      registrationId: registration._id.toString(),
    };

    return await this.stripeService.createEventCheckoutSession(sessionData);
  }

  private async createInstallmentPlan(
    registration: EventRegistrationDocument,
    remainingBalance: number,
    financingPlanId: string,
  ) {
    // Create installment plan using local financing service
    // This will be implemented with the local financing service
    // For now, we'll just store the reference
    registration.installmentPlanId = new Types.ObjectId();
    await registration.save();
  }

  private async sendPaymentConfirmationEmail(
    registration: EventRegistrationDocument,
    paymentTracker: EventPaymentTrackerDocument,
  ) {
    // Send payment confirmation email using professional template
    const event = await this.eventModel.findById(registration.eventId);

    const { partialPaymentConfirmationTemplate } = await import('../email/templates/partial-payment-confirmation.template');

    const paymentType = paymentTracker.paymentType === PaymentType.DEPOSIT
      ? 'deposit'
      : paymentTracker.paymentType === PaymentType.FINAL_PAYMENT
      ? 'final'
      : 'installment';

    const html = partialPaymentConfirmationTemplate({
      firstName: registration.firstName,
      eventName: event?.name || 'Master Course',
      paymentType,
      amount: paymentTracker.amount,
      currency: 'USD',
      totalAmount: registration.totalAmount || 0,
      totalPaid: registration.totalPaid || 0,
      remainingBalance: registration.remainingBalance || 0,
      transactionId: paymentTracker.stripePaymentIntentId || paymentTracker.paymentId,
      registrationId: registration.registrationNumber || `REG-${registration._id.toString().slice(-8).toUpperCase()}`,
      isFullyPaid: registration.isFullyPaid || false,
      eventDate: event?.date?.toString(),
      eventStartDate: event?.startDate,
      eventEndDate: event?.endDate,
      nextPaymentDue: registration.nextPaymentDueDate,
    });

    const subject = registration.isFullyPaid
      ? `¡Pago Completo! - ${event?.name}`
      : `Pago Recibido - ${event?.name}`;

    await this.emailService.sendBasicEmail(registration.email, subject, html);
  }

  private async sendPaymentCompletionEmail(
    registration: EventRegistrationDocument,
  ) {
    // Send the full event registration email with all event details
    const event = await this.eventModel.findById(registration.eventId);

    try {
      // Use the EmailService's sendEventRegistrationEmail method
      // This ensures proper formatting and template selection based on event type
      await this.emailService.sendEventRegistrationEmail(registration.email, {
        eventName: event?.name || '',
        eventType: (event?.type || 'master_course') as 'master_course' | 'community_event' | 'vip_event',
        firstName: registration.firstName,
        isPaid: true,
        amount: registration.totalAmount,
        currency: 'USD',
        eventDate: event?.date,
        eventStartDate: event?.startDate ? new Date(event.startDate) : undefined,
        eventEndDate: event?.endDate ? new Date(event.endDate) : undefined,
        eventLocation: event?.location,
        additionalInfo: {
          phoneNumber: registration.phoneNumber,
          ...registration.additionalInfo,
        },
        includesSaturdayDinner: event?.metadata?.includesSaturdayDinner || false,
      });

      console.log(`✅ Full event registration email sent to ${registration.email}`);
    } catch (error) {
      console.error('Error sending completion email:', error);
      // Don't throw - payment was successful, email is secondary
    }
  }

  /**
   * Clean up abandoned checkouts (no payment after 2 hours)
   * Called by cron job every hour
   */
  async cleanupAbandonedCheckouts() {
    try {
      const now = new Date();

      // Find registrations that:
      // 1. Have no payment made (totalPaid === 0)
      // 2. Checkout session has expired (2 hours)
      // 3. Are in pending status
      const abandonedRegistrations = await this.eventRegistrationModel.find({
        totalPaid: 0,
        paymentStatus: 'pending',
        checkoutSessionExpiresAt: { $lt: now },
      });

      if (abandonedRegistrations.length === 0) {
        console.log('🧹 No abandoned checkouts to clean up');
        return {
          deletedCount: 0,
          message: 'No abandoned checkouts found',
        };
      }

      console.log(`🧹 Found ${abandonedRegistrations.length} abandoned checkouts to clean up`);

      // Delete abandoned registrations and their payment trackers
      const registrationIds = abandonedRegistrations.map(reg => reg._id);

      // Delete payment trackers first
      const deletedTrackers = await this.paymentTrackerModel.deleteMany({
        registrationId: { $in: registrationIds },
        status: PaymentStatus.PENDING,
      });

      // Delete registrations
      const deletedRegistrations = await this.eventRegistrationModel.deleteMany({
        _id: { $in: registrationIds },
      });

      console.log(`✅ Cleaned up ${deletedRegistrations.deletedCount} abandoned registrations`);
      console.log(`✅ Cleaned up ${deletedTrackers.deletedCount} pending payment trackers`);

      return {
        deletedCount: deletedRegistrations.deletedCount,
        deletedTrackers: deletedTrackers.deletedCount,
        message: `Cleaned up ${deletedRegistrations.deletedCount} abandoned checkouts`,
      };
    } catch (error) {
      console.error('❌ Error cleaning up abandoned checkouts:', error);
      throw error;
    }
  }
}