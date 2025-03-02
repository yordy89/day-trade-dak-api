import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema()
export class Video {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  vimeoId: string; // Vimeo Video ID

  @Prop()
  thumbnail: string; // Thumbnail URL

  @Prop({ default: true })
  isActive: boolean; // Control visibility of videoss
}

export const VideoSchema = SchemaFactory.createForClass(Video);
