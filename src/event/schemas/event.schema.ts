// src/events/schemas/event.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date; // full date + time of event

  @Prop()
  location: string;

  @Prop()
  bannerImage: string; // optional, URL of image

  @Prop({ default: 0 })
  vipPrice: number; // price in USD or your currency
}

export const EventSchema = SchemaFactory.createForClass(Event);
