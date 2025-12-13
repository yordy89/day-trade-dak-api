import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinancingPlanDocument = FinancingPlan & Document;

export enum PaymentFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class FinancingPlan {
  @Prop({ required: true, unique: true })
  planId: string; // e.g., "4_biweekly", "3_monthly", "2_monthly"

  @Prop({ required: true })
  name: string; // e.g., "4 pagos quincenales"

  @Prop({ required: true })
  nameEN: string; // e.g., "4 biweekly payments"

  @Prop({ required: true })
  description: string; // e.g., "Divide tu pago en 4 cuotas quincenales sin intereses"

  @Prop({ required: true })
  descriptionEN: string; // English description

  @Prop({ required: true })
  numberOfPayments: number; // e.g., 4

  @Prop({ required: true, enum: PaymentFrequency })
  frequency: PaymentFrequency;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  minAmount: number; // Minimum order amount in USD

  @Prop({ required: true })
  maxAmount: number; // Maximum order amount in USD

  @Prop({ default: 0, min: 0, max: 100 })
  downPaymentPercent: number; // 0-100 (0 = no down payment required)

  @Prop({ default: 0 })
  processingFeePercent: number; // Hidden fee percentage (like Afterpay)

  @Prop({ default: 1 })
  sortOrder: number; // Display order in frontend

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Additional configuration

  // Stripe-specific settings
  @Prop({ default: true })
  autoCharge: boolean; // Use Stripe subscriptions for automatic charging

  @Prop({ default: 0 })
  gracePeriodDays: number; // Days before marking as late

  @Prop({ default: 0 })
  lateFeeAmount: number; // Fixed late fee amount

  @Prop({ default: 0 })
  lateFeePercent: number; // Percentage late fee

  createdAt?: Date;
  updatedAt?: Date;
}

export const FinancingPlanSchema = SchemaFactory.createForClass(FinancingPlan);

// Add indexes (planId already has unique: true in @Prop which creates an index)
FinancingPlanSchema.index({ isActive: 1, sortOrder: 1 });
FinancingPlanSchema.index({ minAmount: 1, maxAmount: 1 });