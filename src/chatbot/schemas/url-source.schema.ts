import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { KnowledgeCategory, LanguageType } from './knowledge-document.schema';

export type UrlSourceDocument = UrlSource & Document;

export enum CrawlStatus {
  PENDING = 'pending',
  CRAWLING = 'crawling',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class UrlSource {
  @Prop({ required: true, unique: true })
  url: string;

  @Prop({ required: true })
  title: string;

  @Prop({ enum: KnowledgeCategory, required: true })
  category: KnowledgeCategory;

  @Prop({ enum: LanguageType, required: true })
  language: LanguageType;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Number, default: null })
  refreshIntervalHours: number | null;

  @Prop({ type: Date, default: null })
  lastCrawled: Date | null;

  @Prop({ type: Date, default: null })
  nextCrawl: Date | null;

  @Prop({ enum: CrawlStatus, default: CrawlStatus.PENDING })
  status: CrawlStatus;

  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'KnowledgeDocument', default: [] })
  documentIds: Types.ObjectId[];

  @Prop({ default: 0 })
  chunksCount: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const UrlSourceSchema = SchemaFactory.createForClass(UrlSource);

UrlSourceSchema.index({ status: 1, nextCrawl: 1 });
UrlSourceSchema.index({ isActive: 1 });
UrlSourceSchema.index({ category: 1, language: 1 });
