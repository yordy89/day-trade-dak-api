import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubscriptionPlan } from 'src/users/user.dto';

export enum SubscriptionAction {
  CREATED = 'created',
  RENEWED = 'renewed',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REACTIVATED = 'reactivated',
  PRICE_CHANGED = 'price_changed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
}

export enum CancellationReason {
  USER_REQUESTED = 'user_requested',
  PAYMENT_FAILED = 'payment_failed',
  ADMIN_ACTION = 'admin_action',
  EXPIRED = 'expired',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class SubscriptionHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Transaction', required: true })
  transactionId: Types.ObjectId;

  @Prop({ required: true, enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Prop({ enum: SubscriptionPlan })
  previousPlan?: SubscriptionPlan;

  @Prop({ required: true, enum: SubscriptionAction })
  action: SubscriptionAction;

  @Prop()
  stripeSubscriptionId?: string;

  @Prop()
  stripeEventId?: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  previousPrice?: number;

  @Prop()
  discountApplied?: number;

  @Prop()
  currency: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ enum: CancellationReason })
  cancellationReason?: CancellationReason;

  @Prop()
  cancellationNote?: string;

  @Prop()
  effectiveDate: Date;

  @Prop()
  expirationDate?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const SubscriptionHistorySchema =
  SchemaFactory.createForClass(SubscriptionHistory);

// Add indexes for better query performance
SubscriptionHistorySchema.index({ userId: 1, createdAt: -1 });
SubscriptionHistorySchema.index({ transactionId: 1 });
SubscriptionHistorySchema.index({ plan: 1, action: 1 });
SubscriptionHistorySchema.index({ stripeSubscriptionId: 1 });
SubscriptionHistorySchema.index({ action: 1, createdAt: -1 });
SubscriptionHistorySchema.index({ effectiveDate: 1 });
