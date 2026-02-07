import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

export enum GalleryItemType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Schema({ timestamps: true })
export class GalleryItem {
  @Prop({ required: true, enum: GalleryItemType })
  type: GalleryItemType;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  key: string; // S3 key for deletion

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  title?: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  mimeType?: string;

  @Prop()
  size?: number; // in bytes

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  duration?: number; // for videos, in seconds
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);

// Index for efficient queries
GalleryItemSchema.index({ isActive: 1, order: 1 });
GalleryItemSchema.index({ type: 1, isActive: 1 });
