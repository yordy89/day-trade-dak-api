import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

export enum GalleryItemType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum HlsStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
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

  // HLS video support
  @Prop({ enum: HlsStatus })
  hlsStatus?: HlsStatus;

  @Prop()
  hlsUrl?: string; // URL to master.m3u8 when HLS is ready

  @Prop()
  hlsKey?: string; // S3 key prefix for HLS files
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);

// Index for efficient queries
GalleryItemSchema.index({ isActive: 1, order: 1 });
GalleryItemSchema.index({ type: 1, isActive: 1 });
GalleryItemSchema.index({ hlsStatus: 1 });
