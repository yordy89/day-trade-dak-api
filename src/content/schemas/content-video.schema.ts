import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ContentVideoDocument = ContentVideo & Document;

export enum VideoStatus {
  UPLOADING = 'uploading',
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
  ARCHIVED = 'archived',
}

export enum WorkflowStatus {
  DRAFT = 'draft',
  PENDING_EDIT = 'pending_edit',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

export enum VersionType {
  ORIGINAL = 'original',
  EDITED = 'edited',
  FINAL = 'final',
}

export enum ContentType {
  PSICOTRADING = 'psicotrading',
  DAILY_CLASSES = 'daily_classes',
  MASTER_CLASSES = 'master_classes',
  STOCKS = 'stocks',
}

export enum VideoQuality {
  HD_1080P = '1080p',
  HD_720P = '720p',
  SD_480P = '480p',
  SD_360P = '360p',
}

@Schema({ timestamps: true })
export class ContentVideo {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: String, enum: ContentType, required: true })
  contentType: ContentType;

  @Prop({ type: String, enum: VideoStatus, default: VideoStatus.UPLOADING })
  status: VideoStatus;

  @Prop()
  originalFileName: string;

  @Prop()
  s3Key: string;

  @Prop()
  s3Bucket: string;

  @Prop()
  fileSize: number;

  @Prop()
  duration: number;

  @Prop()
  thumbnailS3Key: string;

  @Prop({ type: [String], enum: VideoQuality })
  availableQualities: VideoQuality[];

  @Prop({ type: Object })
  hlsManifest: {
    masterPlaylistKey: string;
    variantPlaylists: Array<{
      quality: VideoQuality;
      playlistKey: string;
      bandwidth: number;
      resolution: string;
    }>;
  };

  @Prop({ type: Object })
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
    aspectRatio?: string;
  };

  @Prop()
  uploadedBy: string;

  @Prop()
  uploadedAt: Date;

  @Prop()
  processedAt: Date;

  @Prop()
  processingJobId: string;

  @Prop()
  processingError: string;

  @Prop({ type: Object })
  uploadProgress: {
    uploadId: string;
    parts: Array<{
      partNumber: number;
      etag: string;
      size: number;
    }>;
    bytesUploaded: number;
    totalBytes: number;
  };

  @Prop({ default: false })
  isPublished: boolean;

  @Prop()
  publishedAt: Date;

  @Prop({ type: [String] })
  tags: string[];

  @Prop()
  viewCount: number;

  @Prop({ type: Object })
  analytics: {
    totalViews: number;
    uniqueViewers: number;
    averageWatchTime: number;
    completionRate: number;
  };

  // Version tracking
  @Prop({ default: 1 })
  version: number;

  @Prop({ type: String, enum: VersionType, default: VersionType.ORIGINAL })
  versionType: VersionType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ContentVideo' })
  parentVideoId: string;

  @Prop({ type: [Object] })
  versionHistory: Array<{
    videoId: string;
    version: number;
    versionType: VersionType;
    uploadedBy: string;
    uploadedAt: Date;
    notes: string;
  }>;

  // Workflow
  @Prop({ type: String, enum: WorkflowStatus, default: WorkflowStatus.DRAFT })
  workflowStatus: WorkflowStatus;

  @Prop()
  assignedTo: string; // Email of person assigned

  @Prop()
  assignedAt: Date;

  @Prop()
  assignedBy: string;

  // Notifications
  @Prop({ type: Object })
  notificationSettings: {
    onUpload: string[];
    onEdit: string[];
    onApproval: string[];
    onPublish: string[];
  };

  @Prop({ type: [Object] })
  notificationHistory: Array<{
    type: string;
    sentTo: string[];
    sentAt: Date;
    status: 'sent' | 'failed';
    error?: string;
  }>;

  // Processing control
  @Prop({ default: true })
  autoProcessHLS: boolean;

  @Prop()
  hlsProcessedAt: Date;

  @Prop({ default: false })
  hlsProcessingRequested: boolean;

  // Edit and review notes
  @Prop()
  editNotes: string;

  @Prop()
  reviewNotes: string;

  @Prop()
  rejectionReason: string;

  @Prop()
  approvedBy: string;

  @Prop()
  approvedAt: Date;

  @Prop()
  rejectedBy: string;

  @Prop()
  rejectedAt: Date;
}

export const ContentVideoSchema = SchemaFactory.createForClass(ContentVideo);

ContentVideoSchema.index({ contentType: 1, status: 1 });
ContentVideoSchema.index({ uploadedBy: 1, createdAt: -1 });
ContentVideoSchema.index({ s3Key: 1 });
ContentVideoSchema.index({ processingJobId: 1 });
ContentVideoSchema.index({ isPublished: 1, contentType: 1 });
ContentVideoSchema.index({ parentVideoId: 1 });
ContentVideoSchema.index({ workflowStatus: 1 });
ContentVideoSchema.index({ assignedTo: 1, workflowStatus: 1 });
ContentVideoSchema.index({ version: 1, parentVideoId: 1 });