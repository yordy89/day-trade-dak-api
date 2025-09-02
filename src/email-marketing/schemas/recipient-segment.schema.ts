import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RecipientSegmentDocument = RecipientSegment & Document;

@Schema({ timestamps: true })
export class RecipientSegment {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, required: true })
  filters: {
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
  };

  @Prop({ default: 0 })
  estimatedCount: number;

  @Prop()
  lastCalculated?: Date;

  @Prop({ default: true })
  isDynamic: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  lastUsed?: Date;

  @Prop({ type: [String] })
  tags?: string[];

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const RecipientSegmentSchema = SchemaFactory.createForClass(RecipientSegment);

RecipientSegmentSchema.index({ createdBy: 1, isActive: 1 });
RecipientSegmentSchema.index({ tags: 1 });