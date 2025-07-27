import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminLogDocument = AdminLog & Document;

@Schema({ timestamps: true })
export class AdminLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminId: Types.ObjectId | string;

  @Prop({ required: true })
  adminEmail: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  resource: string;

  @Prop({ type: Types.ObjectId })
  resourceId?: Types.ObjectId | string;

  @Prop({ type: Object })
  details?: Record<string, any>;

  @Prop({ type: Object })
  previousValue?: Record<string, any>;

  @Prop({ type: Object })
  newValue?: Record<string, any>;

  @Prop({ required: true })
  ipAddress: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: 'success', enum: ['success', 'failure'] })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const AdminLogSchema = SchemaFactory.createForClass(AdminLog);
