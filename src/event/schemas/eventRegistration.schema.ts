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
}

export const EventRegistrationSchema =
  SchemaFactory.createForClass(EventRegistration);
