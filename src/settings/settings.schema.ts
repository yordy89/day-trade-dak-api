import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { SettingCategory, SettingType, SettingMetadata } from './interfaces/setting.interface';

export type SettingDocument = Setting & Document;

@Schema({ timestamps: true })
export class Setting {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: any;

  @Prop({ 
    required: true, 
    enum: Object.values(SettingType),
    default: SettingType.STRING 
  })
  type: SettingType;

  @Prop({ 
    required: true, 
    enum: Object.values(SettingCategory),
    index: true 
  })
  category: SettingCategory;

  @Prop({ type: Object, required: true })
  metadata: SettingMetadata;

  @Prop({ type: MongooseSchema.Types.Mixed })
  defaultValue: any;

  @Prop()
  lastModifiedBy: string;

  @Prop()
  lastModifiedAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);

// Add indexes for better query performance
SettingSchema.index({ category: 1, isActive: 1 });
SettingSchema.index({ key: 1, isActive: 1 });