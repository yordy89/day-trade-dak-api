import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactMessageDocument = ContactMessage & Document & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export enum InquiryType {
  GENERAL = 'general',
  TECHNICAL = 'technical',
  BILLING = 'billing',
  PARTNERSHIP = 'partnership',
  MEDIA = 'media',
  OTHER = 'other',
}

export enum ContactMessageStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true })
export class ContactMessage {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  phone: string;

  @Prop({ 
    required: true,
    enum: Object.values(InquiryType),
    default: InquiryType.GENERAL
  })
  inquiryType: InquiryType;

  @Prop({ required: true })
  message: string;

  @Prop({ 
    enum: Object.values(ContactMessageStatus),
    default: ContactMessageStatus.UNREAD
  })
  status: ContactMessageStatus;

  @Prop()
  readAt: Date;

  @Prop()
  readBy: string;
}

export const ContactMessageSchema = SchemaFactory.createForClass(ContactMessage);

// Add indexes for better query performance
ContactMessageSchema.index({ status: 1, createdAt: -1 });
ContactMessageSchema.index({ email: 1 });
ContactMessageSchema.index({ inquiryType: 1 });