import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  ContentVideo, 
  ContentVideoDocument, 
  VideoStatus, 
  ContentType,
  WorkflowStatus,
  VersionType 
} from '../../content/schemas/content-video.schema';
import { VideoUploadService } from '../../content/services/video-upload.service';
import { VideoNotificationService } from '../../content/services/video-notification.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WebSocketGateway } from '../../websockets/websockets.gateway';

export interface VideoUploadOptionsDto {
  fileName: string;
  fileSize: number;
  contentType: ContentType;
  title?: string;
  description?: string;
  editNotes?: string;
  
  // Version management
  parentVideoId?: string;
  versionType?: VersionType;
  
  // Workflow
  workflowStatus?: WorkflowStatus;
  assignedTo?: string;
  
  // Notifications
  notifyOnUpload?: string[];
  notifyOnEdit?: string[];
  notifyOnApproval?: string[];
  notifyOnPublish?: string[];
  
  // Processing
  autoProcessHLS?: boolean;
}

@Injectable()
export class AdminContentWorkflowService {
  private readonly logger = new Logger(AdminContentWorkflowService.name);

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly videoUploadService: VideoUploadService,
    private readonly videoNotificationService: VideoNotificationService,
    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
    private readonly webSocketGateway: WebSocketGateway,
  ) {}

  async initiateVideoUploadWithWorkflow(
    options: VideoUploadOptionsDto,
    user: any,
  ) {
    const uploadedBy = `${user.firstName} ${user.lastName} (${user.email})`;
    
    try {
      // Determine version information
      let version = 1;
      let versionType = options.versionType || VersionType.ORIGINAL;
      let versionHistory = [];

      if (options.parentVideoId) {
        const parentVideo = await this.contentVideoModel.findById(options.parentVideoId);
        if (!parentVideo) {
          throw new BadRequestException('Parent video not found');
        }
        
        // Calculate version number
        const childVideos = await this.contentVideoModel.countDocuments({
          parentVideoId: options.parentVideoId,
        });
        version = childVideos + 2; // Parent is v1, so children start at v2
        versionType = options.versionType || VersionType.EDITED;
        
        // Copy version history from parent
        versionHistory = parentVideo.versionHistory || [];
        versionHistory.push({
          videoId: parentVideo._id.toString(),
          version: parentVideo.version || 1,
          versionType: parentVideo.versionType || VersionType.ORIGINAL,
          uploadedBy: parentVideo.uploadedBy,
          uploadedAt: parentVideo.uploadedAt,
          notes: parentVideo.editNotes || '',
        });
      }

      // Generate S3 key
      const s3Key = this.generateS3Key(options.contentType, options.fileName);
      
      // Initiate multipart upload
      const { uploadId, uploadUrl } = await this.videoUploadService.initiateMultipartUpload(
        s3Key,
        options.fileName,
      );

      // Determine initial workflow status
      let workflowStatus = options.workflowStatus || WorkflowStatus.DRAFT;
      if (options.assignedTo) {
        workflowStatus = WorkflowStatus.PENDING_EDIT;
      }

      // Create video document with workflow fields
      const video = await this.contentVideoModel.create({
        title: options.title || options.fileName.replace(/\.[^/.]+$/, ''),
        description: options.description,
        originalFileName: options.fileName,
        contentType: options.contentType,
        status: VideoStatus.UPLOADING,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'day-trade-dak-resources',
        fileSize: options.fileSize,
        uploadedBy,
        uploadedAt: new Date(),
        
        // Version tracking
        version,
        versionType,
        parentVideoId: options.parentVideoId,
        versionHistory,
        
        // Workflow
        workflowStatus,
        assignedTo: options.assignedTo,
        assignedAt: options.assignedTo ? new Date() : undefined,
        assignedBy: options.assignedTo ? uploadedBy : undefined,
        
        // Edit notes
        editNotes: options.editNotes,
        
        // Notifications
        notificationSettings: {
          onUpload: options.notifyOnUpload || [],
          onEdit: options.notifyOnEdit || [],
          onApproval: options.notifyOnApproval || [],
          onPublish: options.notifyOnPublish || [],
        },
        
        // Processing control
        autoProcessHLS: options.autoProcessHLS !== false, // Default true
        
        // Upload progress
        uploadProgress: {
          uploadId,
          parts: [],
          bytesUploaded: 0,
          totalBytes: options.fileSize,
        },
      });

      // Emit WebSocket event
      this.webSocketGateway.server.emit('video-upload-initiated', {
        videoId: video._id,
        fileName: options.fileName,
        fileSize: options.fileSize,
        contentType: options.contentType,
        status: VideoStatus.UPLOADING,
        version,
        versionType,
        workflowStatus,
      });

      return {
        videoId: video._id,
        uploadId,
        uploadUrl,
        s3Key,
        version,
        versionType,
        workflowStatus,
      };
    } catch (error) {
      this.logger.error('Failed to initiate video upload with workflow', error);
      throw error;
    }
  }

  async completeUploadWithWorkflow(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    try {
      // Complete S3 multipart upload
      await this.videoUploadService.completeMultipartUpload(
        video.s3Key,
        uploadId,
        parts,
      );

      // Update video status
      video.status = VideoStatus.UPLOADED;
      video.uploadProgress.parts = parts.map(p => ({ ...p, size: 0 }));
      video.uploadProgress.bytesUploaded = video.fileSize;
      
      // Process HLS if enabled
      if (video.autoProcessHLS) {
        await this.videoQueue.add('process-video', {
          videoId: video._id.toString(),
          s3Key: video.s3Key,
          contentType: video.contentType,
        });
        video.status = VideoStatus.PROCESSING;
      }
      
      await video.save();

      // Send notifications based on workflow
      if (video.notificationSettings?.onUpload?.length > 0) {
        await this.videoNotificationService.sendVideoUploadedNotification(
          videoId,
          video.notificationSettings.onUpload,
        );
      }

      // Update workflow status if assigned
      if (video.assignedTo) {
        video.workflowStatus = WorkflowStatus.PENDING_EDIT;
        await video.save();
      }

      // Emit completion event
      this.webSocketGateway.server.emit('video-upload-completed', {
        videoId: video._id,
        fileName: video.originalFileName,
        status: video.status,
        workflowStatus: video.workflowStatus,
      });

      return {
        message: 'Upload completed successfully',
        videoId: video._id,
        status: video.status,
        workflowStatus: video.workflowStatus,
        version: video.version,
      };
    } catch (error) {
      this.logger.error('Failed to complete upload with workflow', error);
      video.status = VideoStatus.ERROR;
      video.processingError = error.message;
      await video.save();
      throw error;
    }
  }

  async manuallyTriggerHLSProcessing(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.status !== VideoStatus.UPLOADED && video.status !== VideoStatus.ERROR) {
      throw new BadRequestException('Video must be in uploaded or error state to trigger processing');
    }

    // Add to processing queue
    await this.videoQueue.add('process-video', {
      videoId: video._id.toString(),
      s3Key: video.s3Key,
      contentType: video.contentType,
    });

    // Update status
    video.status = VideoStatus.PROCESSING;
    video.hlsProcessingRequested = true;
    await video.save();

    // Emit event
    this.webSocketGateway.server.emit('video-hls-processing-started', {
      videoId: video._id,
      fileName: video.originalFileName,
    });

    return {
      message: 'HLS processing triggered successfully',
      videoId: video._id,
    };
  }

  async updateWorkflowStatus(
    videoId: string,
    newStatus: WorkflowStatus,
    userId: string,
    notes?: string,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const previousStatus = video.workflowStatus;
    video.workflowStatus = newStatus;

    // Handle status-specific updates
    switch (newStatus) {
      case WorkflowStatus.APPROVED:
        video.approvedBy = userId;
        video.approvedAt = new Date();
        video.reviewNotes = notes;
        break;
      case WorkflowStatus.REJECTED:
        video.rejectedBy = userId;
        video.rejectedAt = new Date();
        video.rejectionReason = notes || 'Quality standards not met';
        break;
      case WorkflowStatus.PUBLISHED:
        video.isPublished = true;
        video.publishedAt = new Date();
        break;
    }

    await video.save();

    // Send notifications based on workflow transition
    await this.videoNotificationService.notifyBasedOnWorkflowStatus(
      videoId,
      previousStatus,
      newStatus,
    );

    // Emit WebSocket event
    this.webSocketGateway.server.emit('video-workflow-updated', {
      videoId: video._id,
      previousStatus,
      newStatus,
      updatedBy: userId,
    });

    return {
      message: `Workflow status updated to ${newStatus}`,
      videoId: video._id,
      workflowStatus: newStatus,
    };
  }

  async assignVideo(
    videoId: string,
    assigneeEmail: string,
    assignedBy: string,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    video.assignedTo = assigneeEmail;
    video.assignedAt = new Date();
    video.assignedBy = assignedBy;
    
    // Update workflow status if it's still in draft
    if (video.workflowStatus === WorkflowStatus.DRAFT) {
      video.workflowStatus = WorkflowStatus.PENDING_EDIT;
    }

    await video.save();

    // Send notification to assignee
    await this.videoNotificationService.sendVideoUploadedNotification(
      videoId,
      [assigneeEmail],
    );

    return {
      message: `Video assigned to ${assigneeEmail}`,
      videoId: video._id,
      assignedTo: assigneeEmail,
      workflowStatus: video.workflowStatus,
    };
  }

  async getVideoVersions(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Get all versions (parent and children)
    const parentId = video.parentVideoId || video._id;
    const allVersions = await this.contentVideoModel
      .find({
        $or: [
          { _id: parentId },
          { parentVideoId: parentId },
        ],
      })
      .sort({ version: 1 })
      .select('_id title version versionType status workflowStatus uploadedBy uploadedAt editNotes')
      .exec();

    return {
      currentVersion: video.version,
      parentVideoId: parentId,
      versions: allVersions,
      versionHistory: video.versionHistory || [],
    };
  }

  private generateS3Key(contentType: ContentType, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = this.getContentFolder(contentType);
    return `${folder}/${timestamp}_${sanitizedFileName}`;
  }
  
  private getContentFolder(contentType: ContentType): string {
    switch (contentType) {
      case ContentType.DAILY_CLASSES:
        return 'video-content/daily-classes';
      case ContentType.MASTER_CLASSES:
        return 'video-content/master-classes';
      case ContentType.PSICOTRADING:
        return 'video-content/psicotrading';
      case ContentType.STOCKS:
        return 'video-content/stocks';
      default:
        return 'video-content/general';
    }
  }
}