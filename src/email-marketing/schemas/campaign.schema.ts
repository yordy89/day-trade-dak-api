import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignDocument = Campaign & Document;

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum CampaignType {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
  RECURRING = 'recurring',
  TRIGGERED = 'triggered'
}

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  previewText?: string;

  @Prop({ type: String, enum: CampaignType, default: CampaignType.IMMEDIATE })
  type: CampaignType;

  @Prop({ type: String, enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Prop({ type: Types.ObjectId, ref: 'EmailTemplate' })
  templateId?: Types.ObjectId;

  @Prop({ type: Object })
  htmlContent?: string;

  @Prop({ type: Object })
  jsonContent?: object;

  @Prop({ type: Object })
  recipientFilters?: {
    subscriptions?: string[];
    noSubscription?: boolean;
    status?: string[];
    roles?: string[];
    eventIds?: string[];
    modulePermissions?: string[];
    lastLoginDays?: number;
    registrationDateRange?: {
      start?: Date;
      end?: Date;
    };
    customEmails?: string[];
    brevoListIds?: number[];
    excludeListIds?: number[];
    savedSegmentId?: string;
  };

  @Prop({ type: [String] })
  recipientEmails?: string[];

  @Prop({ default: 0 })
  recipientCount: number;

  @Prop()
  scheduledDate?: Date;

  @Prop()
  sentDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;

  @Prop({ type: Object })
  analytics?: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    unsubscribed?: number;
    complained?: number;
    revenue?: number;
    conversions?: number;
  };

  @Prop({ type: Object })
  testEmails?: string[];

  @Prop({ type: Object })
  abTesting?: {
    enabled: boolean;
    variants?: Array<{
      name: string;
      subject?: string;
      content?: string;
      percentage: number;
    }>;
    winnerCriteria?: string;
    testDuration?: number;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  brevoSendId?: string;

  @Prop({ type: Object })
  error?: {
    message: string;
    timestamp: Date;
    details?: any;
  };
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ status: 1, scheduledDate: 1 });
CampaignSchema.index({ createdBy: 1, createdAt: -1 });
CampaignSchema.index({ 'recipientFilters.subscriptions': 1 });
CampaignSchema.index({ 'recipientFilters.brevoListIds': 1 });