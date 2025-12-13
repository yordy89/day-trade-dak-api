import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventPaymentTrackerDocument = EventPaymentTracker & Document;

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentType {
  DEPOSIT = 'deposit',
  INSTALLMENT = 'installment',
  FULL_PAYMENT = 'full_payment',
  PARTIAL_PAYMENT = 'partial_payment',
  FINAL_PAYMENT = 'final_payment',
  CUSTOM_PAYMENT = 'custom_payment',
}

@Schema({ timestamps: true })
export class EventPaymentTracker {
  @Prop({ type: Types.ObjectId, ref: 'EventRegistration', required: true, index: true })
  registrationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  email: string;

  // Payment details
  @Prop({ required: true, unique: true, index: true })
  paymentId: string; // Unique payment identifier

  @Prop({ required: true, enum: PaymentType })
  paymentType: PaymentType;

  @Prop({ required: true })
  amount: number;

  @Prop()
  currency: string; // USD, EUR, etc.

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  // Stripe integration
  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  stripeSessionId?: string;

  @Prop()
  stripeChargeId?: string;

  @Prop()
  stripeRefundId?: string;

  @Prop()
  receiptUrl?: string;

  // Payment method details
  @Prop()
  paymentMethod?: string; // card, klarna, afterpay, bank_transfer, etc.

  @Prop({ type: Object })
  paymentMethodDetails?: {
    brand?: string; // visa, mastercard, etc.
    last4?: string;
    expMonth?: number;
    expYear?: number;
    funding?: string; // credit, debit, prepaid
  };

  // Transaction details
  @Prop()
  processedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  refundedAt?: Date;

  @Prop()
  failureReason?: string;

  @Prop()
  refundReason?: string;

  @Prop({ default: 0 })
  refundAmount?: number;

  // Balance tracking
  @Prop()
  previousBalance?: number; // Balance before this payment

  @Prop()
  newBalance?: number; // Balance after this payment

  @Prop()
  totalEventPrice?: number; // Total price of the event

  // Installment plan reference (if applicable)
  @Prop({ type: Types.ObjectId, ref: 'InstallmentPlan' })
  installmentPlanId?: Types.ObjectId;

  @Prop()
  installmentNumber?: number; // Which installment number this is

  @Prop()
  totalInstallments?: number; // Total number of installments

  // Metadata and notes
  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  description?: string; // Human-readable description

  @Prop()
  adminNotes?: string;

  @Prop()
  customerNotes?: string;

  // Processing fees (if any)
  @Prop({ default: 0 })
  processingFee?: number;

  @Prop({ default: 0 })
  netAmount?: number; // Amount after fees

  // Retry tracking
  @Prop({ default: 0 })
  retryCount?: number;

  @Prop()
  lastRetryAt?: Date;

  @Prop()
  nextRetryAt?: Date;

  // Notification tracking
  @Prop({ default: false })
  receiptEmailSent?: boolean;

  @Prop()
  receiptEmailSentAt?: Date;

  @Prop({ default: false })
  reminderSent?: boolean;

  @Prop()
  reminderSentAt?: Date;

  // IP and device tracking for security
  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Object })
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const EventPaymentTrackerSchema = SchemaFactory.createForClass(EventPaymentTracker);

// Add indexes for better query performance
EventPaymentTrackerSchema.index({ stripePaymentIntentId: 1 });
EventPaymentTrackerSchema.index({ registrationId: 1, status: 1 });
EventPaymentTrackerSchema.index({ eventId: 1, status: 1 });
EventPaymentTrackerSchema.index({ email: 1, eventId: 1 });
EventPaymentTrackerSchema.index({ status: 1, createdAt: -1 });
EventPaymentTrackerSchema.index({ paymentType: 1, status: 1 });
EventPaymentTrackerSchema.index({ installmentPlanId: 1 });
EventPaymentTrackerSchema.index({ createdAt: -1 });

// Virtual for payment status display
EventPaymentTrackerSchema.virtual('displayStatus').get(function(this: EventPaymentTrackerDocument) {
  const statusMap = {
    [PaymentStatus.PENDING]: 'Pending',
    [PaymentStatus.PROCESSING]: 'Processing',
    [PaymentStatus.COMPLETED]: 'Completed',
    [PaymentStatus.FAILED]: 'Failed',
    [PaymentStatus.REFUNDED]: 'Refunded',
    [PaymentStatus.CANCELLED]: 'Cancelled',
  };
  return statusMap[this.status] || this.status;
});

// Virtual for payment type display
EventPaymentTrackerSchema.virtual('displayType').get(function(this: EventPaymentTrackerDocument) {
  const typeMap = {
    [PaymentType.DEPOSIT]: 'Initial Deposit',
    [PaymentType.INSTALLMENT]: `Installment ${this.installmentNumber || ''}`,
    [PaymentType.FULL_PAYMENT]: 'Full Payment',
    [PaymentType.PARTIAL_PAYMENT]: 'Partial Payment',
    [PaymentType.FINAL_PAYMENT]: 'Final Payment',
    [PaymentType.CUSTOM_PAYMENT]: 'Payment',
  };
  return typeMap[this.paymentType] || this.paymentType;
});