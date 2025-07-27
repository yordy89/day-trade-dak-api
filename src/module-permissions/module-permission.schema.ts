import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ModulePermissionDocument = ModulePermission & Document;

export enum ModuleType {
  CLASSES = 'classes',
  MASTER_CLASSES = 'masterClasses',
  LIVE_RECORDED = 'liveRecorded',
  PSICOTRADING = 'psicotrading',
  PEACE_WITH_MONEY = 'peaceWithMoney',
  LIVE_WEEKLY = 'liveWeekly',
  COMMUNITY_EVENTS = 'communityEvents',
  VIP_EVENTS = 'vipEvents',
  MASTER_COURSE = 'masterCourse',
}

@Schema({ timestamps: true })
export class ModulePermission {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ModuleType })
  moduleType: ModuleType;

  @Prop({ required: true })
  hasAccess: boolean;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  grantedBy: Types.ObjectId;

  @Prop()
  reason?: string;

  @Prop({ default: true })
  isActive: boolean;

  // Track if this permission was auto-generated from subscription
  @Prop({ default: false })
  fromSubscription: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;
}

export const ModulePermissionSchema =
  SchemaFactory.createForClass(ModulePermission);

// Indexes for performance
ModulePermissionSchema.index({ userId: 1, moduleType: 1 });
ModulePermissionSchema.index({ expiresAt: 1 });
ModulePermissionSchema.index({ isActive: 1 });

// Ensure only one active permission per user per module
ModulePermissionSchema.index(
  { userId: 1, moduleType: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
