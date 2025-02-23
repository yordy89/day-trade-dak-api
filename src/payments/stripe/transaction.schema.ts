import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SubscriptionPlan } from 'src/users/user.dto';

@Schema()
export class Transaction extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true, enum: SubscriptionPlan })
  plan: SubscriptionPlan; // ✅ Stores which plan was purchased

  @Prop()
  subscriptionId?: string; // ✅ Stores Stripe subscription ID (if recurring)

  @Prop()
  expiresAt?: Date; // ✅ Stores expiration date for fixed subscriptions

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
