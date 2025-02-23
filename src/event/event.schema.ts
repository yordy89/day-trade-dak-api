import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  start: string; // Full ISO 8601 format

  @Prop({ required: true })
  end: string; // Full ISO 8601 format

  @Prop({ required: true })
  startDate: string; // YYYY-MM-DD format

  @Prop({ required: true })
  endDate: string; // YYYY-MM-DD format

  @Prop()
  startTime?: string; // HH:mm format (if not all-day)

  @Prop()
  endTime?: string; // HH:mm format (if not all-day)

  @Prop({ default: false })
  allDay: boolean;

  @Prop({ required: true, enum: ['global', 'personal', 'earnings'] })
  type: string;

  @Prop()
  userId?: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
