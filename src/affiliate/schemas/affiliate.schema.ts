import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AffiliateDocument = Affiliate & Document;

@Schema({ timestamps: true })
export class Affiliate {
  createdAt?: Date;
  updatedAt?: Date;
  @Prop({ required: true, unique: true, uppercase: true })
  affiliateCode: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: false })
  phoneNumber?: string;

  @Prop({ required: true, enum: ['percentage', 'fixed'], default: 'percentage' })
  discountType: 'percentage' | 'fixed';

  @Prop({ required: false, min: 0, max: 50 })
  discountPercentage?: number;

  @Prop({ required: false, min: 0 })
  discountFixedAmount?: number;

  @Prop({ required: true, enum: ['percentage', 'fixed'], default: 'percentage' })
  commissionType: 'percentage' | 'fixed';

  @Prop({ required: false, min: 0, max: 50 })
  commissionRate?: number;

  @Prop({ required: false, min: 0 })
  commissionFixedAmount?: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  totalSales: number;

  @Prop({ default: 0 })
  totalCommission: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop({ type: Object })
  metadata?: {
    notes?: string;
    bankInfo?: string;
    paymentMethod?: string;
    [key: string]: any;
  };

  // Stripe integration fields
  @Prop()
  stripeCouponId?: string;

  @Prop()
  stripePromotionCodeId?: string;
}

export const AffiliateSchema = SchemaFactory.createForClass(Affiliate);

// Create indexes for faster lookups
AffiliateSchema.index({ affiliateCode: 1 });
AffiliateSchema.index({ email: 1 });
AffiliateSchema.index({ isActive: 1 });