import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from 'src/constants';
import { SubscriptionPlan } from './user.dto';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phone?: string;

  @Prop()
  address?: string;

  @Prop()
  profileImage: string;

  @Prop({ default: Role.USER })
  role: Role;

  @Prop()
  recoveryToken: string;

  @Prop()
  tradingPhase: number;

  @Prop({
    type: [
      {
        plan: { type: String, enum: SubscriptionPlan, required: true },
        expiresAt: { type: Date, required: false },
        stripeSubscriptionId: { type: String, required: false },
        createdAt: { type: Date, required: false },
        currentPeriodEnd: { type: Date, required: false },
        status: { type: String, required: false },
      },
    ],
    default: [],
  })
  subscriptions: {
    plan: SubscriptionPlan;
    expiresAt?: Date;
    stripeSubscriptionId?: string;
    createdAt?: Date;
    currentPeriodEnd?: Date;
    status?: string;
  }[]; // ✅ Enhanced to track more subscription details

  @Prop({ type: [String], default: [] })
  activeSubscriptions: string[]; // ✅ Stores Stripe subscription IDs for recurring plans

  @Prop({ required: false, unique: true, sparse: true })
  stripeCustomerId?: string; // ✅ Stores Stripe customer ID

  @Prop()
  fullName?: string;

  @Prop({ default: 'active' })
  status?: string;

  @Prop()
  lastLogin?: Date;

  @Prop({ default: false })
  allowLiveMeetingAccess?: boolean;

  @Prop({ default: false })
  allowLiveWeeklyAccess?: boolean;

  @Prop({ default: false })
  approvedForLocalFinancing?: boolean;

  @Prop({
    type: {
      approvedBy: { type: String },
      approvedAt: { type: Date },
      maxAmount: { type: Number },
      notes: { type: String },
    },
  })
  localFinancingDetails?: {
    approvedBy: string;
    approvedAt: Date;
    maxAmount: number;
    notes: string;
  };

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ default: false })
  acceptedMediaUsageTerms?: boolean;

  @Prop()
  mediaUsageTermsAcceptedAt?: Date;

  @Prop({ default: false })
  acceptedCommunityGuidelines?: boolean;

  @Prop()
  communityGuidelinesAcceptedAt?: Date;

  // Email marketing preferences
  @Prop({ 
    type: {
      marketing: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true },
      events: { type: Boolean, default: true },
      educational: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      transactional: { type: Boolean, default: true }, // Always true for important emails
      unsubscribedAt: Date,
      resubscribedAt: Date,
    },
    default: {
      marketing: true,
      newsletter: true,
      events: true,
      educational: true,
      promotional: true,
      transactional: true,
    }
  })
  emailPreferences?: {
    marketing: boolean;
    newsletter: boolean;
    events: boolean;
    educational: boolean;
    promotional: boolean;
    transactional: boolean;
    unsubscribedAt?: Date;
    resubscribedAt?: Date;
  };

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  // Soft delete fields for GDPR compliance
  @Prop({ default: false })
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  deletedBy?: string; // Admin ID who deleted the account

  @Prop({ enum: ['user_request', 'admin_action', 'gdpr_compliance', 'terms_violation', 'inactivity'] })
  deletionReason?: 'user_request' | 'admin_action' | 'gdpr_compliance' | 'terms_violation' | 'inactivity';

  @Prop()
  scheduledDeletionDate?: Date; // For 30-day grace period

  @Prop({ default: false })
  isAnonymized?: boolean; // Track if PII has been anonymized
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for efficient subscription lookups (prevents duplicate queries)
UserSchema.index(
  { '_id': 1, 'subscriptions.stripeSubscriptionId': 1 },
  { sparse: true }
);

// Virtual populate for module permissions
UserSchema.virtual('modulePermissions', {
  ref: 'ModulePermission',
  localField: '_id',
  foreignField: 'userId',
  match: { isActive: true },
});
