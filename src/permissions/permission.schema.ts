import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PermissionDocument = Permission & Document;

@Schema()
export class PermissionSet {
  @Prop({ default: true })
  dashboard: boolean;

  @Prop({ default: false })
  users: boolean;

  @Prop({ default: false })
  subscriptions: boolean;

  @Prop({ default: false })
  payments: boolean;

  @Prop({ default: false })
  meetings: boolean;

  @Prop({ default: false })
  events: boolean;

  @Prop({ default: false })
  content: boolean;

  @Prop({ default: false })
  courses: boolean;

  @Prop({ default: false })
  announcements: boolean;

  @Prop({ default: false })
  analytics: boolean;

  @Prop({ default: false })
  transactions: boolean;

  @Prop({ default: false })
  reports: boolean;

  @Prop({ default: false })
  settings: boolean;

  @Prop({ default: false })
  auditLogs: boolean;

  @Prop({ default: false })
  permissions: boolean; // Only for super_admin
}

@Schema({ timestamps: true })
export class Permission extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: PermissionSet, default: () => ({}) })
  permissions: PermissionSet;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Create index for faster lookups
PermissionSchema.index({ userId: 1 });

// Default permissions for different roles
export const DEFAULT_ADMIN_PERMISSIONS: Partial<PermissionSet> = {
  dashboard: true,
  users: true,
  analytics: true,
  reports: true,
  settings: true,
};

export const DEFAULT_SUPER_ADMIN_PERMISSIONS: Partial<PermissionSet> = {
  dashboard: true,
  users: true,
  subscriptions: true,
  payments: true,
  meetings: true,
  events: true,
  content: true,
  courses: true,
  announcements: true,
  analytics: true,
  transactions: true,
  reports: true,
  settings: true,
  auditLogs: true,
  permissions: true,
};