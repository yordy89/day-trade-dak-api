import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignAnalyticsDocument = CampaignAnalytics & Document;

@Schema({ timestamps: true })
export class CampaignAnalytics {
  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true })
  recipientEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ default: false })
  sent: boolean;

  @Prop()
  sentAt?: Date;

  @Prop({ default: false })
  isTestEmail: boolean;

  @Prop({ default: false })
  delivered: boolean;

  @Prop()
  deliveredAt?: Date;

  @Prop({ default: false })
  opened: boolean;

  @Prop()
  firstOpenedAt?: Date;

  @Prop({ default: 0 })
  openCount: number;

  @Prop({ type: [Date] })
  openTimestamps?: Date[];

  @Prop({ default: false })
  clicked: boolean;

  @Prop()
  firstClickedAt?: Date;

  @Prop({ default: 0 })
  clickCount: number;

  @Prop({ type: [Object] })
  clicks?: Array<{
    url: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;

  @Prop({ default: false })
  bounced: boolean;

  @Prop()
  bounceType?: string;

  @Prop()
  bounceReason?: string;

  @Prop({ default: false })
  unsubscribed: boolean;

  @Prop()
  unsubscribedAt?: Date;

  @Prop({ default: false })
  complained: boolean;

  @Prop()
  complainedAt?: Date;

  @Prop({ default: 0 })
  revenue: number;

  @Prop({ type: [Object] })
  conversions?: Array<{
    type: string;
    value: number;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;

  @Prop({ type: Object })
  deviceInfo?: {
    type?: string;
    os?: string;
    browser?: string;
    location?: string;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const CampaignAnalyticsSchema = SchemaFactory.createForClass(CampaignAnalytics);

CampaignAnalyticsSchema.index({ campaignId: 1, recipientEmail: 1 }, { unique: true });
CampaignAnalyticsSchema.index({ campaignId: 1, opened: 1 });
CampaignAnalyticsSchema.index({ campaignId: 1, clicked: 1 });
CampaignAnalyticsSchema.index({ userId: 1, createdAt: -1 });