import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnnouncementDocument = Announcement & Document & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export enum AnnouncementType {
  FED_MEETING = 'fed_meeting',
  EARNINGS = 'earnings',
  MARKET_NEWS = 'market_news',
  PLATFORM_UPDATE = 'platform_update',
  WEBINAR = 'webinar',
  COURSE = 'course',
  MENTORSHIP = 'mentorship',
  GENERAL = 'general',
}

export enum AnnouncementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AnnouncementStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  ARCHIVED = 'archived',
}

export enum DisplayFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ALWAYS = 'always',
}

@Schema({ timestamps: true })
export class Announcement {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    required: true,
    enum: Object.values(AnnouncementType),
    default: AnnouncementType.GENERAL
  })
  type: AnnouncementType;

  @Prop({
    required: true,
    enum: Object.values(AnnouncementPriority),
    default: AnnouncementPriority.MEDIUM
  })
  priority: AnnouncementPriority;

  @Prop({
    enum: Object.values(AnnouncementStatus),
    default: AnnouncementStatus.DRAFT
  })
  status: AnnouncementStatus;

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  link: string;

  @Prop()
  linkText: string;

  @Prop()
  icon: string;

  @Prop({ default: '#1976d2' })
  backgroundColor: string;

  @Prop({ default: '#ffffff' })
  textColor: string;

  @Prop({ default: '#ffffff' })
  linkColor: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: true })
  dismissible: boolean;

  @Prop({ default: 24 })
  dismissDurationHours: number;

  @Prop({
    enum: Object.values(DisplayFrequency),
    default: DisplayFrequency.DAILY
  })
  displayFrequency: DisplayFrequency;

  @Prop()
  imageUrl: string;

  @Prop({ default: 'default' })
  template: string;

  @Prop({ type: Object })
  customStyles: {
    headerBg?: string;
    headerText?: string;
    bodyBg?: string;
    bodyText?: string;
    buttonBg?: string;
    buttonText?: string;
    borderColor?: string;
    animation?: string;
  };

  @Prop()
  customHtml: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  targetAudience: string[];

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  clickCount: number;

  @Prop({ default: 0 })
  dismissCount: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

// Indexes for better query performance
AnnouncementSchema.index({ isActive: 1, status: 1, startDate: 1, endDate: 1 });
AnnouncementSchema.index({ type: 1, priority: 1 });
AnnouncementSchema.index({ createdAt: -1 });

// Ensure only one announcement can be active at a time
AnnouncementSchema.pre('save', async function(next) {
  if (this.isActive && this.isModified('isActive')) {
    const model = this.constructor as any;
    await model.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { $set: { isActive: false } }
    );
  }
  next();
});