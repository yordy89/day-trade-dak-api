import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from 'src/constants';
import { SubscriptionPlan } from './user.dto';

@Schema()
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
    type: [String],
    enum: SubscriptionPlan,
    default: [SubscriptionPlan.FREE],
  })
  subscriptions: SubscriptionPlan[]; // ✅ Stores all active subscriptions

  @Prop({ type: Date, required: false })
  subscriptionExpiresAt?: Date; // ✅ Stores expiration for fixed subscriptions

  @Prop({ type: [String], default: [] })
  activeSubscriptions: string[]; // ✅ Stores Stripe subscription IDs for recurring plans

  @Prop({ required: false, unique: true })
  stripeCustomerId?: string; // ✅ Stores Stripe customer ID
}

export const UserSchema = SchemaFactory.createForClass(User);
