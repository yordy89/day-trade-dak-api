import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PermissionDocument = Permission & Document;

// Define PermissionSet as a simple interface
export interface PermissionSet {
  dashboard: boolean;
  users: boolean;
  subscriptions: boolean;
  payments: boolean;
  meetings: boolean;
  events: boolean;
  content: boolean;
  courses: boolean;
  announcements: boolean;
  analytics: boolean;
  transactions: boolean;
  reports: boolean;
  settings: boolean;
  auditLogs: boolean;
  permissions: boolean;
  contactMessages: boolean;
  modulePermissions: boolean; // New: Permisos de Módulos
}

// Define the schema for the permissions object
const PermissionSetSchema = {
  dashboard: { type: Boolean, default: false },
  users: { type: Boolean, default: false },
  subscriptions: { type: Boolean, default: false },
  payments: { type: Boolean, default: false },
  meetings: { type: Boolean, default: false },
  events: { type: Boolean, default: false },
  content: { type: Boolean, default: false },
  courses: { type: Boolean, default: false },
  announcements: { type: Boolean, default: false },
  analytics: { type: Boolean, default: false },
  transactions: { type: Boolean, default: false },
  reports: { type: Boolean, default: false },
  settings: { type: Boolean, default: false },
  auditLogs: { type: Boolean, default: false },
  permissions: { type: Boolean, default: false },
  contactMessages: { type: Boolean, default: false },
  modulePermissions: { type: Boolean, default: false }, // New: Permisos de Módulos
};

@Schema({ timestamps: true })
export class Permission extends Document {
  @Prop({ type: String, ref: 'User', required: true, unique: true })
  userId: string | Types.ObjectId;

  @Prop({ type: PermissionSetSchema, default: () => ({}) })
  permissions: PermissionSet;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Index removed - userId already has unique index from @Prop

// Default permissions for different roles
export const DEFAULT_ADMIN_PERMISSIONS: Partial<PermissionSet> = {
  dashboard: true,
  users: true,
  analytics: true,
  reports: true,
  settings: true,
  contactMessages: true,
  modulePermissions: false, // Admins don't get module permissions by default
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
  permissions: true, // Only super admins can manage permissions
  contactMessages: true,
  modulePermissions: true, // Super admins have module permissions
};
