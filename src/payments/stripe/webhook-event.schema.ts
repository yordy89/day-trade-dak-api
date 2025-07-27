import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum WebhookEventStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored',
}

@Schema({ timestamps: true })
export class WebhookEvent extends Document {
  @Prop({ required: true, unique: true })
  stripeEventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true, enum: WebhookEventStatus })
  status: WebhookEventStatus;

  @Prop({ type: Object, required: true })
  eventData: Record<string, any>;

  @Prop()
  errorMessage?: string;

  @Prop()
  errorStack?: string;

  @Prop()
  processedAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Add indexes (removed stripeEventId since it's already unique in @Prop)
WebhookEventSchema.index({ eventType: 1 });
WebhookEventSchema.index({ status: 1 });
WebhookEventSchema.index({ createdAt: -1 });
