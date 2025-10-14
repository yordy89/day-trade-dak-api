import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

export enum FeedbackRating {
  POOR = 1,
  BELOW_AVERAGE = 2,
  AVERAGE = 3,
  GOOD = 4,
  EXCELLENT = 5,
}

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: 'Trade', required: true, index: true })
  tradeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  mentorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  // Structured Feedback
  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  improvements: string[];

  @Prop({ type: [String], default: [] })
  patternsIdentified: string[];

  // Detailed Review
  @Prop({ maxlength: 1000 })
  entryAnalysis?: string;

  @Prop({ maxlength: 1000 })
  exitAnalysis?: string;

  @Prop({ maxlength: 1000 })
  riskManagementReview?: string;

  @Prop({ maxlength: 1000 })
  psychologyNotes?: string;

  @Prop({ maxlength: 1000 })
  setupQualityReview?: string;

  // Recommendations
  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: [String], default: [] })
  suggestedResources: string[];

  @Prop({ type: [String], default: [] })
  actionItems: string[];

  // Ratings
  @Prop({ enum: FeedbackRating, required: true })
  overallRating: FeedbackRating;

  @Prop({ enum: FeedbackRating, required: true })
  riskManagementRating: FeedbackRating;

  @Prop({ enum: FeedbackRating, required: true })
  executionRating: FeedbackRating;

  @Prop({ enum: FeedbackRating })
  psychologyRating?: FeedbackRating;

  @Prop({ enum: FeedbackRating })
  analysisRating?: FeedbackRating;

  // Priority & Follow-up
  @Prop({ default: false })
  requiresFollowUp: boolean;

  @Prop()
  followUpDate?: Date;

  @Prop({ default: false })
  isAddressed: boolean;

  @Prop()
  addressedAt?: Date;

  @Prop({ maxlength: 500 })
  studentResponse?: string;

  // Visibility
  @Prop({ default: true })
  isVisible: boolean;

  @Prop({ default: false })
  isPinned: boolean;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

// Indexes for performance
FeedbackSchema.index({ tradeId: 1, mentorId: 1 });
FeedbackSchema.index({ studentId: 1, createdAt: -1 });
FeedbackSchema.index({ mentorId: 1, createdAt: -1 });
FeedbackSchema.index({ requiresFollowUp: 1, followUpDate: 1 });