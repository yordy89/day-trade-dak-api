import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export enum NotificationType {
  CONTACT_MESSAGE = 'contact_message',
  USER_REGISTRATION = 'user_registration',
  PAYMENT_RECEIVED = 'payment_received',
  SYSTEM_ALERT = 'system_alert',
  MEETING_REMINDER = 'meeting_reminder',
  COURSE_ENROLLMENT = 'course_enrollment',
  SUBSCRIPTION_UPDATE = 'subscription_update',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ 
    required: true,
    enum: Object.values(NotificationType)
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  @Prop({ 
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.UNREAD
  })
  status: NotificationStatus;

  @Prop({ 
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.MEDIUM
  })
  priority: NotificationPriority;

  @Prop()
  actionUrl: string;

  @Prop()
  icon: string;

  @Prop()
  recipient: string; // Admin user ID

  @Prop()
  readAt: Date;

  @Prop()
  expiresAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Add indexes for better query performance
NotificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });