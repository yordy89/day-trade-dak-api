import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommissionDocument = Commission & Document;

@Schema({ timestamps: true })
export class Commission {
  createdAt?: Date;
  updatedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Affiliate', required: true })
  affiliateId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EventRegistration', required: true })
  registrationId: Types.ObjectId;

  @Prop({ required: true })
  affiliateCode: string;

  @Prop({ required: true })
  customerEmail: string;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  originalPrice: number;

  @Prop({ required: true })
  discountAmount: number;

  @Prop({ required: true })
  finalPrice: number;

  @Prop({ required: true })
  commissionRate: number;

  @Prop({ required: true })
  commissionAmount: number;

  @Prop({ 
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  })
  status: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  stripeSessionId?: string;

  @Prop()
  paymentMethod?: string;

  @Prop({ type: Object })
  metadata?: {
    eventName?: string;
    eventDate?: Date;
    notes?: string;
    [key: string]: any;
  };
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);

// Create indexes
CommissionSchema.index({ affiliateId: 1 });
CommissionSchema.index({ status: 1 });
CommissionSchema.index({ createdAt: -1 });