import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoClassDocument = VideoClass & Document;

@Schema()
export class VideoClass extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, unique: true })
  s3Key: string; // 🔹 The S3 object key

  @Prop({ required: false })
  captionsS3Key?: string; // 🔹 Optional captions key
}

export const VideoClassSchema = SchemaFactory.createForClass(VideoClass);
