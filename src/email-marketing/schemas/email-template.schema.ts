import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailTemplateDocument = EmailTemplate & Document;

export enum TemplateCategory {
  NEWSLETTER = 'newsletter',
  PROMOTIONAL = 'promotional',
  ANNOUNCEMENT = 'announcement',
  EVENT = 'event',
  EDUCATIONAL = 'educational',
  TRANSACTIONAL = 'transactional',
  CUSTOM = 'custom'
}

@Schema({ timestamps: true })
export class EmailTemplate {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: String, enum: TemplateCategory, default: TemplateCategory.CUSTOM })
  category: TemplateCategory;

  @Prop()
  thumbnail?: string;

  @Prop({ required: true })
  htmlContent: string;

  @Prop({ type: Object })
  jsonConfig?: object;

  @Prop({ type: Object })
  defaultValues?: {
    subject?: string;
    previewText?: string;
    [key: string]: any;
  };

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  lastUsed?: Date;

  @Prop({ type: [String] })
  tags?: string[];

  @Prop({ type: Object })
  variables?: Array<{
    name: string;
    type: string;
    defaultValue?: any;
    required?: boolean;
  }>;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);

EmailTemplateSchema.index({ category: 1, isPublic: 1 });
EmailTemplateSchema.index({ createdBy: 1, isActive: 1 });
EmailTemplateSchema.index({ tags: 1 });