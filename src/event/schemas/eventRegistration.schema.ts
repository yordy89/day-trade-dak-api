// src/event-registrations/schemas/event-registration.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventRegistrationDocument = EventRegistration & Document;

@Schema({ timestamps: true })
export class EventRegistration {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

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
}

export const EventRegistrationSchema =
  SchemaFactory.createForClass(EventRegistration);
