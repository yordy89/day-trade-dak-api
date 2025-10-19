// src/events/schemas/event.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  name: string;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date; // full date + time of event

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  location: string;

  @Prop()
  bannerImage: string; // optional, URL of image

  @Prop({ default: 0 })
  vipPrice: number; // price in USD or your currency

  @Prop({ default: true })
  isActive: boolean;

  // New fields for enhanced event functionality
  @Prop({
    enum: ['master_course', 'community_event', 'general', 'workshop', 'webinar', 'seminar', 'bootcamp', 'conference'],
    default: 'general',
  })
  type: string;

  @Prop({ default: 0 })
  price: number; // General event price (not just VIP)

  @Prop({ default: false })
  requiresActiveSubscription: boolean;

  @Prop({ default: 0 })
  capacity: number;

  @Prop({ default: 0 })
  currentRegistrations: number;

  @Prop({ type: Object, default: {} })
  metadata: {
    hotel?: string;
    hotelAddress?: string;
    includesAccommodation?: boolean;
    includesMeals?: boolean;
    includesSaturdayDinner?: boolean;
  };

  @Prop({ type: [String], default: [] })
  included: string[];

  @Prop({ type: [String], default: [] })
  notIncluded: string[];

  @Prop({ type: [String], default: [] })
  requirements: string[];

  @Prop({ type: Object, default: {} })
  contact: {
    email?: string;
    phone?: string;
    whatsapp?: string;
  };

  @Prop({ type: Object })
  coordinates: {
    lat?: number;
    lng?: number;
  };

  @Prop({
    enum: ['active', 'draft', 'completed'],
    default: 'active',
  })
  status: string;

  @Prop({ default: false })
  featuredInCRM: boolean;

  @Prop({ default: false })
  showInLandingPage: boolean;

  // Payment settings for partial payments
  @Prop({
    enum: ['full_only', 'partial_allowed'],
    default: 'full_only',
  })
  paymentMode: 'full_only' | 'partial_allowed';

  @Prop({ default: 0 })
  minimumDepositAmount: number; // Minimum deposit amount in USD

  @Prop({ default: 0 })
  depositPercentage: number; // Alternative: percentage of total price (0-100)

  @Prop({ default: 50 })
  minimumInstallmentAmount: number; // Minimum amount for each installment payment

  @Prop({ type: [String], default: [] })
  allowedFinancingPlans: string[]; // References to FinancingPlan.planId

  @Prop({ default: true })
  allowCustomPaymentPlan: boolean; // Allow users to pay any amount above minimum

  @Prop({ type: Object })
  paymentSettings: {
    enablePartialPayments?: boolean;
    autoReminderDays?: number[]; // Days before due date to send reminders
    gracePeriodDays?: number; // Days after due date before marking as late
    lateFeeAmount?: number;
    lateFeePercentage?: number;
    maxPaymentAttempts?: number;
  };
}

export const EventSchema = SchemaFactory.createForClass(Event);
