import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type KnowledgeDocumentDocument = KnowledgeDocument & Document;

export enum KnowledgeCategory {
  FAQ = 'faq',
  ACADEMY = 'academy',
  MENTORSHIP = 'mentorship',
  NAVIGATION = 'navigation',
  PRICING = 'pricing',
  GENERAL = 'general',
}

export enum RegionType {
  US = 'us',
  ES = 'es',
  BOTH = 'both',
}

export enum LanguageType {
  EN = 'en',
  ES = 'es',
}

export class DocumentMetadata {
  @Prop({ enum: LanguageType, required: true })
  language: LanguageType;

  @Prop({ required: true, default: Date.now })
  lastUpdated: Date;

  @Prop({ default: 1 })
  version: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop()
  source?: string;
}

@Schema({ timestamps: true })
export class KnowledgeDocument {
  @Prop({ enum: RegionType, required: true, index: true })
  region: RegionType;

  @Prop({ enum: KnowledgeCategory, required: true, index: true })
  category: KnowledgeCategory;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ type: DocumentMetadata, required: true })
  metadata: DocumentMetadata;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  chunkIndex?: number;

  @Prop()
  parentDocumentId?: string;
}

export const KnowledgeDocumentSchema =
  SchemaFactory.createForClass(KnowledgeDocument);

// Create indexes for efficient vector search and filtering
KnowledgeDocumentSchema.index({ region: 1, category: 1 });
KnowledgeDocumentSchema.index({ 'metadata.language': 1, region: 1 });
KnowledgeDocumentSchema.index({ isActive: 1, region: 1 });
KnowledgeDocumentSchema.index({ category: 1, 'metadata.language': 1 });

// Note: For MongoDB Atlas Vector Search, you'll need to create a vector search index
// through the Atlas UI or API with the following configuration:
// {
//   "mappings": {
//     "dynamic": true,
//     "fields": {
//       "embedding": {
//         "dimensions": 1536,
//         "similarity": "cosine",
//         "type": "knnVector"
//       }
//     }
//   }
// }
