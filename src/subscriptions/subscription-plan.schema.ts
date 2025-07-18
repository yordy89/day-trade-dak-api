import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

export enum PlanInterval {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  YEARLY = 'yearly',
  ONCE = 'once',
}

export enum PlanType {
  LIVE = 'live',
  COURSE = 'course',
  EVENT = 'event',
  BUNDLE = 'bundle',
}

export interface ConditionalPricingRule {
  type: 'discount' | 'free';
  requiredPlans: string[];
  discountAmount?: number;
  discountPercentage?: number;
  discountReason?: string;
}

export interface StripeIds {
  productId: string;
  priceId: string;
}

@Schema({
  timestamps: true,
  collection: 'subscription_plans',
})
export class SubscriptionPlan {
  @Prop({ required: true, unique: true })
  planId: string; // e.g., 'LiveWeeklyManual', 'MasterClases'

  @Prop({ 
    type: {
      en: { type: String, required: true },
      es: { type: String, required: true }
    },
    required: true
  })
  displayName: {
    en: string;
    es: string;
  };

  @Prop({ 
    type: {
      en: { type: String, required: true },
      es: { type: String, required: true }
    },
    required: true
  })
  description: {
    en: string;
    es: string;
  };

  // Stripe IDs for different environments
  @Prop({
    type: {
      development: {
        type: {
          productId: { type: String, required: true },
          priceId: { type: String, required: true }
        },
        required: true
      },
      production: {
        type: {
          productId: { type: String, required: true },
          priceId: { type: String, required: true }
        },
        required: true
      }
    },
    required: true
  })
  stripeIds: {
    development: StripeIds;
    production: StripeIds;
  };

  // Legacy fields for backward compatibility (to be deprecated)
  @Prop({ required: false })
  stripeProductId?: string;

  @Prop({ required: false })
  stripePriceId?: string;

  @Prop({ required: false })
  displayNameES?: string;

  @Prop({ required: false })
  descriptionES?: string;

  // Pricing information
  @Prop({
    type: {
      baseAmount: { type: Number, required: true }, // Price in cents
      currency: { type: String, required: true, default: 'usd' },
      interval: { type: String, enum: Object.values(PlanInterval), required: true },
      intervalCount: { type: Number, default: 1 }
    },
    required: true
  })
  pricing: {
    baseAmount: number;
    currency: string;
    interval: PlanInterval;
    intervalCount: number;
  };

  @Prop({ required: false })
  amount?: number; // Legacy field for backward compatibility

  @Prop({ required: false })
  currency?: string; // Legacy field for backward compatibility

  @Prop({ required: false, enum: PlanInterval })
  interval?: PlanInterval; // Legacy field for backward compatibility

  @Prop({ default: 1 })
  intervalCount?: number; // Legacy field for backward compatibility

  // Conditional pricing rules
  @Prop({
    type: [{
      type: {
        _id: false,
        type: { type: String, enum: ['discount', 'free'], required: true },
        requiredPlans: { type: [String], required: true },
        discountAmount: { type: Number },
        discountPercentage: { type: Number },
        discountReason: { type: String }
      }
    }],
    default: []
  })
  conditionalPricing: ConditionalPricingRule[];

  @Prop({ required: true, enum: PlanType })
  type: PlanType;

  @Prop({ 
    type: {
      en: { type: [String], default: [] },
      es: { type: [String], default: [] }
    },
    default: { en: [], es: [] }
  })
  features: {
    en: string[];
    es: string[];
  };

  @Prop({ type: [String], default: [] })
  featuresES?: string[]; // Legacy field for backward compatibility

  // Meeting-related limits and permissions
  @Prop({
    type: {
      canCreateMeetings: { type: Boolean, default: false },
      maxMeetingsPerMonth: { type: Number, default: 0 },
      maxMeetingDuration: { type: Number, default: 60 }, // in minutes
      maxParticipantsPerMeeting: { type: Number, default: 10 },
      canRecordMeetings: { type: Boolean, default: false },
      canScheduleMeetings: { type: Boolean, default: false },
      hasLiveMeetingAccess: { type: Boolean, default: false },
    },
    default: {},
  })
  meetingPermissions: {
    canCreateMeetings: boolean;
    maxMeetingsPerMonth: number;
    maxMeetingDuration: number;
    maxParticipantsPerMeeting: number;
    canRecordMeetings: boolean;
    canScheduleMeetings: boolean;
    hasLiveMeetingAccess: boolean;
  };

  // Access to other features
  @Prop({ type: [String], default: [] })
  includedCourses: string[]; // Course IDs included with this plan

  // UI Metadata for frontend display
  @Prop({
    type: {
      color: { type: String, required: true },
      icon: { type: String, required: true },
      badge: { type: String },
      popular: { type: Boolean, default: false },
      sortOrder: { type: Number, default: 0 }
    },
    required: true
  })
  uiMetadata: {
    color: string; // Hex color code for UI
    icon: string; // Icon name for frontend
    badge?: string; // Optional badge text (e.g., 'BEST VALUE')
    popular: boolean; // Show as popular/recommended
    sortOrder: number; // Display order
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPopular?: boolean; // Legacy field for backward compatibility

  @Prop({ default: 0 })
  sortOrder?: number; // Legacy field for backward compatibility

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Additional custom data

  // Trial period
  @Prop({ default: 0 })
  trialPeriodDays: number;

  // Promotion codes
  @Prop({ default: true })
  allowPromotionCodes: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);

// Add indexes
SubscriptionPlanSchema.index({ planId: 1 });
SubscriptionPlanSchema.index({ type: 1, isActive: 1 });
SubscriptionPlanSchema.index({ sortOrder: 1 });