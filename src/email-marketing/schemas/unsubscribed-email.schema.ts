import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UnsubscribedEmailDocument = UnsubscribedEmail & Document;

export enum UnsubscribeReason {
  USER_REQUEST = 'user_request',
  BOUNCED = 'bounced',
  COMPLAINT = 'complaint',
  ADMIN_ACTION = 'admin_action',
  INACTIVE = 'inactive',
}

export enum UnsubscribeSource {
  EMAIL_LINK = 'email_link',
  USER_PROFILE = 'user_profile',
  ADMIN_PANEL = 'admin_panel',
  API = 'api',
  IMPORT = 'import',
}

@Schema({ timestamps: true })
export class UnsubscribedEmail {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId?: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: UnsubscribeReason, 
    default: UnsubscribeReason.USER_REQUEST 
  })
  reason: UnsubscribeReason;

  @Prop({ 
    type: String, 
    enum: UnsubscribeSource, 
    default: UnsubscribeSource.EMAIL_LINK 
  })
  source: UnsubscribeSource;

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  notes?: string;

  @Prop({ default: Date.now })
  unsubscribedAt: Date;

  @Prop()
  resubscribedAt?: Date;

  @Prop({ default: true })
  isActive: boolean; // false if they resubscribed
}

export const UnsubscribedEmailSchema = SchemaFactory.createForClass(UnsubscribedEmail);

// Indexes for performance
UnsubscribedEmailSchema.index({ email: 1, isActive: 1 });
UnsubscribedEmailSchema.index({ userId: 1 });
UnsubscribedEmailSchema.index({ unsubscribedAt: -1 });
UnsubscribedEmailSchema.index({ campaignId: 1 });