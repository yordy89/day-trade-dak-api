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

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Virtual populate for module permissions
UserSchema.virtual('modulePermissions', {
  ref: 'ModulePermission',
  localField: '_id',
  foreignField: 'userId',
  match: { isActive: true },
});
