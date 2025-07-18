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
    enum: ['master_course', 'community_event', 'general'],
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
}

export const EventSchema = SchemaFactory.createForClass(Event);
