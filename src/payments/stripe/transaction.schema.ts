import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubscriptionPlan } from 'src/users/user.dto';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  KLARNA = 'klarna',
  AFTERPAY = 'afterpay',
  AFFIRM = 'affirm',
}

export enum BillingCycle {
  ONE_TIME = 'one_time',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum TransactionType {
  SUBSCRIPTION_PAYMENT = 'subscription_payment',
  EVENT_PAYMENT = 'event_payment',
  ONE_TIME_PURCHASE = 'one_time_purchase',
}

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ required: true, enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Prop({
    enum: TransactionType,
    default: TransactionType.SUBSCRIPTION_PAYMENT,
  })
  type: TransactionType;

  @Prop()
  subscriptionId?: string;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  stripeCustomerId?: string;

  @Prop({ enum: PaymentMethod, default: PaymentMethod.CARD })
  paymentMethod: PaymentMethod;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  refundAmount?: number;

  @Prop()
  refundReason?: string;

  @Prop()
  refundId?: string;

  @Prop()
  refundedAt?: Date;

  @Prop()
  failureReason?: string;

  @Prop()
  receiptUrl?: string;

  @Prop()
  invoiceUrl?: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ enum: BillingCycle, default: BillingCycle.ONE_TIME })
  billingCycle: BillingCycle;

  @Prop()
  nextBillingDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  parentSubscriptionId?: Types.ObjectId;

  @Prop()
  discountApplied?: number;

  @Prop()
  originalPrice?: number;

  @Prop()
  finalPrice?: number;

  @Prop()
  stripeSessionId?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Add indexes for better query performance
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ stripePaymentIntentId: 1 });
TransactionSchema.index({ stripeSessionId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ plan: 1, status: 1 });
TransactionSchema.index({ billingCycle: 1 });
TransactionSchema.index({ nextBillingDate: 1 });
TransactionSchema.index({ expiresAt: 1 });
