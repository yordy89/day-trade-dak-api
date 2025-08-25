import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InstallmentPlanDocument = InstallmentPlan & Document;

export enum InstallmentPlanStatus {
  PENDING = 'pending',        // Awaiting first payment
  ACTIVE = 'active',          // Payments in progress
  COMPLETED = 'completed',    // All payments made
  CANCELLED = 'cancelled',    // Cancelled by user or admin
  DEFAULTED = 'defaulted',    // Failed to make payments
}

export interface PaymentRecord {
  paymentNumber: number;
  dueDate: Date;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidDate?: Date;
  stripePaymentIntentId?: string;
  failureReason?: string;
}

@Schema({ timestamps: true })
export class InstallmentPlan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event' })
  eventId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EventRegistration' })
  eventRegistrationId?: Types.ObjectId;

  @Prop({ required: true })
  productType: string; // 'master_course', 'community_event', 'classes', etc.

  @Prop({ required: true })
  productName: string; // Human-readable product name

  @Prop({ required: true })
  totalAmount: number; // Total amount to be financed

  @Prop({ default: 0 })
  downPayment: number; // Initial down payment amount

  @Prop({ required: true })
  financedAmount: number; // Amount being financed (totalAmount - downPayment)

  @Prop({ required: true })
  financingPlanId: string; // Reference to FinancingPlan.planId

  @Prop()
  stripeSubscriptionId?: string; // Stripe subscription ID for automatic payments

  @Prop()
  stripeCustomerId?: string; // Store for reference

  @Prop()
  stripePriceId?: string; // The custom price created for this plan

  @Prop()
  stripeProductId?: string; // The product created for this plan

  @Prop({ required: true })
  installmentAmount: number; // Amount per installment

  @Prop({ required: true })
  numberOfPayments: number; // Total number of payments

  @Prop({ default: 0 })
  paymentsCompleted: number; // Number of payments made

  @Prop({ default: 0 })
  totalPaid: number; // Total amount paid so far (including down payment)

  @Prop({ required: true, enum: InstallmentPlanStatus, default: InstallmentPlanStatus.PENDING })
  status: InstallmentPlanStatus;

  @Prop()
  nextPaymentDate?: Date; // Next scheduled payment date

  @Prop()
  firstPaymentDate?: Date; // Date of first scheduled payment

  @Prop()
  lastPaymentDate?: Date; // Date of last scheduled payment

  @Prop()
  completedAt?: Date; // Date when plan was completed

  @Prop()
  cancelledAt?: Date; // Date when plan was cancelled

  @Prop()
  cancelReason?: string; // Reason for cancellation

  // Payment schedule and history
  @Prop({
    type: [
      {
        paymentNumber: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true },
        status: { 
          type: String, 
          enum: ['pending', 'paid', 'failed', 'refunded'],
          default: 'pending'
        },
        paidDate: { type: Date },
        stripePaymentIntentId: { type: String },
        failureReason: { type: String },
      },
    ],
    default: [],
  })
  paymentSchedule: PaymentRecord[];

  // Fees and additional charges
  @Prop({ default: 0 })
  processingFee: number; // Total processing fee (hidden from customer)

  @Prop({ default: 0 })
  lateFees: number; // Total late fees accumulated

  // Metadata
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Additional data (order details, etc.)

  // Tracking
  @Prop({ default: 0 })
  failedPaymentAttempts: number; // Count of failed payment attempts

  @Prop()
  lastFailedPaymentDate?: Date;

  @Prop()
  lastReminderSentAt?: Date; // For payment reminder emails

  // Admin notes
  @Prop()
  adminNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId; // Admin who created the plan

  createdAt?: Date;
  updatedAt?: Date;
}

export const InstallmentPlanSchema = SchemaFactory.createForClass(InstallmentPlan);

// Add indexes for better query performance
InstallmentPlanSchema.index({ userId: 1, status: 1 });
InstallmentPlanSchema.index({ stripeSubscriptionId: 1 });
InstallmentPlanSchema.index({ status: 1, nextPaymentDate: 1 });
InstallmentPlanSchema.index({ eventId: 1 });
InstallmentPlanSchema.index({ createdAt: -1 });
InstallmentPlanSchema.index({ 'paymentSchedule.dueDate': 1 });