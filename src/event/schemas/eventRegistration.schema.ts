// src/event-registrations/schemas/event-registration.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventRegistrationDocument = EventRegistration & Document;

@Schema({ timestamps: true })
export class EventRegistration {
  @Prop({ type: String, unique: true, sparse: true })
  registrationNumber?: string; // User-friendly ID like REG-20251019-A1B2C

  @Prop({ type: String, required: true })
  eventId: string;

  // Global sync fields
  @Prop({ type: String, index: true, sparse: true })
  globalRegistrationId?: string; // ID from Global API

  @Prop({ type: String, index: true, sparse: true })
  globalEventId?: string; // Global event ID for reference

  @Prop({ default: false })
  isGloballyManaged?: boolean; // True if created from Global API

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  phoneNumber: string;

  @Prop({ default: false })
  isVip: boolean;

  @Prop({ enum: ['pending', 'paid', 'free'], default: 'pending' })
  paymentStatus: 'pending' | 'paid' | 'free';

  @Prop()
  promoCode?: string;

  // New fields for enhanced registration tracking
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Object })
  additionalInfo?: object;

  @Prop({ enum: ['paid', 'free', 'member_exclusive'], default: 'paid' })
  registrationType?: string;

  @Prop()
  amountPaid?: number;

  @Prop()
  stripeSessionId?: string;

  @Prop({ enum: ['card', 'klarna', 'afterpay', 'other'], default: 'card' })
  paymentMethod?: string;

  @Prop()
  klarnaFee?: number;

  // Affiliate/Referral tracking fields
  @Prop()
  affiliateCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'Affiliate' })
  affiliateId?: Types.ObjectId;

  @Prop()
  originalPrice?: number;

  @Prop()
  discountAmount?: number;

  @Prop()
  finalPrice?: number;

  @Prop()
  commissionAmount?: number;

  @Prop({ enum: ['percentage', 'fixed'] })
  commissionType?: 'percentage' | 'fixed';

  @Prop()
  commissionRate?: number;

  @Prop()
  commissionFixedAmount?: number;

  // Partial payment fields
  @Prop({ enum: ['full', 'partial'], default: 'full' })
  paymentMode?: 'full' | 'partial';

  @Prop()
  totalAmount?: number; // Total amount for the registration

  @Prop({ default: 0 })
  depositPaid?: number; // Initial deposit amount paid

  @Prop({ default: 0 })
  totalPaid?: number; // Total amount paid so far (including deposit)

  @Prop()
  remainingBalance?: number; // Calculated: totalAmount - totalPaid

  @Prop({ default: false })
  isFullyPaid?: boolean; // True when totalPaid >= totalAmount

  @Prop({ type: Types.ObjectId, ref: 'InstallmentPlan' })
  installmentPlanId?: Types.ObjectId; // Reference to InstallmentPlan if using financing

  // Payment history tracking
  @Prop({
    type: [
      {
        paymentId: { type: String, required: true }, // Unique payment identifier
        amount: { type: Number, required: true },
        paymentDate: { type: Date, required: true },
        paymentMethod: { type: String }, // card, klarna, afterpay, etc.
        stripePaymentIntentId: { type: String },
        description: { type: String }, // "Initial Deposit", "Installment #2", etc.
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed', 'refunded'],
          default: 'completed'
        },
        receiptUrl: { type: String },
        metadata: { type: Object }
      }
    ],
    default: []
  })
  paymentHistory?: Array<{
    paymentId: string;
    amount: number;
    paymentDate: Date;
    paymentMethod?: string;
    stripePaymentIntentId?: string;
    description?: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    receiptUrl?: string;
    metadata?: any;
  }>;

  @Prop()
  nextPaymentDueDate?: Date; // Next scheduled payment date

  @Prop()
  lastPaymentReminderSent?: Date; // Track when last reminder was sent

  // Abandoned checkout tracking
  @Prop()
  checkoutSessionExpiresAt?: Date; // When the Stripe checkout session expires (24 hours)

  @Prop()
  stripeCheckoutSessionId?: string; // Store the Stripe checkout session ID
}

export const EventRegistrationSchema =
  SchemaFactory.createForClass(EventRegistration);
