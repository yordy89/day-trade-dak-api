import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MeetingDocument = Meeting & Document;

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true, unique: true })
  meetingId: string;

  @Prop({ required: true })
  roomUrl: string;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ required: true, min: 15, max: 480 })
  duration: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  host: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  participants: Types.ObjectId[];

  @Prop({
    required: true,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  status: string;

  @Prop({ default: false })
  isRecurring: boolean;

  @Prop({ enum: ['daily', 'weekly', 'monthly'] })
  recurringType?: string;

  @Prop({ type: [Number] })
  recurringDays?: number[];

  @Prop()
  recurringEndDate?: Date;

  @Prop()
  recurringTime?: string;

  @Prop({ default: 100 })
  maxParticipants: number;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: false })
  requiresApproval: boolean;

  @Prop({ default: false })
  enableRecording: boolean;

  @Prop({ default: true })
  enableChat: boolean;

  @Prop({ default: true })
  enableScreenShare: boolean;

  @Prop({ default: false })
  enableWaitingRoom: boolean;

  @Prop({
    enum: ['daily_live', 'mentorship', 'support', 'special_event', 'other'],
    default: 'other',
  })
  meetingType: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  attendees: Types.ObjectId[];

  @Prop()
  recordingUrl?: string;

  // Zoom-specific fields
  @Prop()
  zoomMeetingId?: string;

  @Prop()
  zoomJoinUrl?: string;

  @Prop()
  zoomStartUrl?: string;

  @Prop()
  zoomPassword?: string;

  // LiveKit-specific fields
  @Prop({ enum: ['zoom', 'videosdk', 'livekit'], default: 'zoom' })
  provider?: string;

  @Prop()
  livekitRoomName?: string;

  @Prop()
  livekitRoomSid?: string;

  @Prop({ type: Object })
  livekitMetadata?: {
    recordingEnabled?: boolean;
    maxParticipants?: number;
    roomType?: string;
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // New subscription-based access control fields
  @Prop({ type: [String], default: [] })
  allowedSubscriptions?: string[]; // Array of subscription plan IDs that can access this meeting

  @Prop({ default: false })
  restrictedToSubscriptions?: boolean; // If true, only users with allowed subscriptions can join

  @Prop({ default: false })
  isLocked?: boolean; // If true, no new participants can join

  @Prop({
    type: Map,
    of: {
      maxDuration: Number,
      canRecord: Boolean,
      maxParticipants: Number,
      canScreenShare: Boolean,
    },
    default: new Map(),
  })
  subscriptionFeatures?: Map<
    string,
    {
      maxDuration?: number;
      canRecord?: boolean;
      maxParticipants?: number;
      canScreenShare?: boolean;
    }
  >; // Features available per subscription type
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

// Add index for subscription-based queries
MeetingSchema.index({ allowedSubscriptions: 1 });
MeetingSchema.index({ meetingType: 1, status: 1 });
