import { Injectable, Logger } from '@nestjs/common';
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
import { EmailService } from '../../email/email.service';

@Injectable()
export class AdminContentSimpleService {
  private readonly logger = new Logger(AdminContentSimpleService.name);

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly videoUploadService: VideoUploadService,
    private readonly videoNotificationService: VideoNotificationService,
    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly emailService: EmailService,
  ) {}

  async initiateVideoUpload(
    fileName: string,
    fileSize: number,
    contentType: ContentType,
    user: any,
  ) {
    const uploadedBy = `${user.firstName} ${user.lastName} (Admin)`;
    
    try {
      const s3Key = this.generateS3Key(contentType, fileName);
      
      const { uploadId, uploadUrl } = await this.videoUploadService.initiateMultipartUpload(
        s3Key,
        fileName,
      );

      const video = await this.contentVideoModel.create({
        title: fileName.replace(/\.[^/.]+$/, ''),
        originalFileName: fileName,
        contentType,
        status: VideoStatus.UPLOADING,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'day-trade-dak-resources',
        fileSize,
        uploadedBy,
        uploadedAt: new Date(),
        uploadProgress: {
          uploadId,
          parts: [],
          bytesUploaded: 0,
          totalBytes: fileSize,
        },
      });

      this.webSocketGateway.server.emit('video-upload-initiated', {
        videoId: video._id,
        fileName,
        fileSize,
        contentType,
        status: VideoStatus.UPLOADING,
      });

      return {
        videoId: video._id,
        uploadId,
        uploadUrl,
        s3Key,
      };
    } catch (error) {
      this.logger.error('Failed to initiate multipart upload', error);
      throw error;
    }
  }

  async getUploadPartUrl(
    videoId: string,
    uploadId: string,
    partNumber: number,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const uploadUrl = await this.videoUploadService.getUploadPartUrl(
      video.s3Key,
      uploadId,
      partNumber,
    );

    return { uploadUrl, partNumber };
  }

  async completeUpload(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    try {
      await this.videoUploadService.completeMultipartUpload(
        video.s3Key,
        uploadId,
        parts,
      );

      video.status = VideoStatus.UPLOADED;
      video.uploadProgress.parts = parts.map(p => ({ ...p, size: 0 }));
      video.uploadProgress.bytesUploaded = video.fileSize;
      await video.save();

      await this.videoQueue.add('process-video', {
        videoId: video._id.toString(),
        s3Key: video.s3Key,
        contentType: video.contentType,
      });

      this.webSocketGateway.server.emit('video-upload-completed', {
        videoId: video._id,
        fileName: video.originalFileName,
        status: VideoStatus.UPLOADED,
      });

      return {
        message: 'Upload completed successfully',
        videoId: video._id,
        status: video.status,
      };
    } catch (error) {
      this.logger.error('Failed to complete multipart upload', error);
      video.status = VideoStatus.ERROR;
      video.processingError = error.message;
      await video.save();
      throw error;
    }
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

  async updateUploadProgress(
    videoId: string,
    bytesUploaded: number,
    partNumber: number,
    etag: string,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Update progress
    video.uploadProgress.bytesUploaded = bytesUploaded;
    
    // Update or add part info
    const existingPartIndex = video.uploadProgress.parts.findIndex(
      p => p.partNumber === partNumber
    );
    
    if (existingPartIndex >= 0) {
      video.uploadProgress.parts[existingPartIndex].etag = etag;
    } else {
      video.uploadProgress.parts.push({
        partNumber,
        etag,
        size: 0, // Will be calculated later
      });
    }

    await video.save();

    // Emit progress event
    const progress = Math.round((bytesUploaded / video.fileSize) * 100);
    this.webSocketGateway.server.emit('video-upload-progress', {
      videoId: video._id,
      progress,
      bytesUploaded,
      totalBytes: video.fileSize,
    });

    return {
      videoId: video._id,
      progress,
      bytesUploaded,
      totalBytes: video.fileSize,
    };
  }

  async abortUpload(videoId: string, uploadId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    try {
      await this.videoUploadService.abortMultipartUpload(
        video.s3Key,
        uploadId,
      );

      // Update video status
      video.status = VideoStatus.ERROR;
      video.processingError = 'Upload aborted by user';
      await video.save();

      // Emit abort event
      this.webSocketGateway.server.emit('video-upload-aborted', {
        videoId: video._id,
        fileName: video.originalFileName,
      });

      return {
        message: 'Upload aborted successfully',
        videoId: video._id,
      };
    } catch (error) {
      this.logger.error('Failed to abort upload', error);
      throw error;
    }
  }

  async getBatchPartUrls(
    videoId: string,
    uploadId: string,
    totalParts: number,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Generate all part URLs at once
    const partUrls = await Promise.all(
      Array.from({ length: totalParts }, (_, i) => i + 1).map(async (partNumber) => {
        const uploadUrl = await this.videoUploadService.getUploadPartUrl(
          video.s3Key,
          uploadId,
          partNumber,
        );
        return { partNumber, uploadUrl };
      })
    );

    return { partUrls };
  }

  async getContentStats() {
    const [totalVideos, byStatus, byContentType, totalSize] = await Promise.all([
      this.contentVideoModel.countDocuments(),
      this.contentVideoModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.contentVideoModel.aggregate([
        { $group: { _id: '$contentType', count: { $sum: 1 } } },
      ]),
      this.contentVideoModel.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$fileSize' } } },
      ]),
    ]);

    const statusCounts = byStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const contentTypeCounts = byContentType.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return {
      totalVideos,
      publishedVideos: statusCounts[VideoStatus.READY] || 0,
      processingVideos: statusCounts[VideoStatus.PROCESSING] || 0,
      uploadingVideos: statusCounts[VideoStatus.UPLOADING] || 0,
      errorVideos: statusCounts[VideoStatus.ERROR] || 0,
      totalStorageUsed: totalSize[0]?.totalSize || 0,
      byContentType: contentTypeCounts,
    };
  }

  async getVideos(params: {
    page: number;
    limit: number;
    search?: string;
    contentType?: string;
    status?: string;
  }) {
    const { page, limit, search, contentType, status } = params;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { originalFileName: { $regex: search, $options: 'i' } },
      ];
    }

    if (contentType) {
      query.contentType = contentType;
    }

    if (status) {
      query.status = status;
    }

    const [videos, total] = await Promise.all([
      this.contentVideoModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contentVideoModel.countDocuments(query),
    ]);

    return {
      videos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateVideo(
    id: string,
    updates: {
      title?: string;
      description?: string;
      isPublished?: boolean;
    },
  ) {
    const video = await this.contentVideoModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );

    if (!video) {
      throw new Error('Video not found');
    }

    return video;
  }

  async reprocessVideo(id: string) {
    const video = await this.contentVideoModel.findById(id);
    
    if (!video) {
      throw new Error('Video not found');
    }

    // Reset status to uploaded to trigger reprocessing
    video.status = VideoStatus.UPLOADED;
    video.processingError = null;
    video.availableQualities = [];
    video.hlsManifest = null;
    await video.save();

    // Add to processing queue
    await this.videoQueue.add('process-video', {
      videoId: video._id.toString(),
      s3Key: video.s3Key,
      contentType: video.contentType,
    });

    this.webSocketGateway.server.emit('video-reprocess-started', {
      videoId: video._id,
      fileName: video.originalFileName,
    });

    return {
      message: 'Video queued for reprocessing',
      videoId: video._id,
    };
  }

  async deleteVideo(id: string) {
    const video = await this.contentVideoModel.findById(id);
    
    if (!video) {
      throw new Error('Video not found');
    }

    try {
      // Delete from S3
      await this.videoUploadService.deleteVideo(video.s3Key);
      
      // Delete HLS files if they exist
      if (video.hlsManifest && video.hlsManifest.masterPlaylistKey) {
        const hlsFolder = video.hlsManifest.masterPlaylistKey.replace('/master.m3u8', '');
        // This would need a batch delete implementation
        this.logger.log(`HLS files would be deleted from: ${hlsFolder}`);
      }

      // Delete from database
      await this.contentVideoModel.findByIdAndDelete(id);

      this.webSocketGateway.server.emit('video-deleted', {
        videoId: video._id,
        fileName: video.originalFileName,
      });

      return {
        message: 'Video deleted successfully',
        videoId: video._id,
      };
    } catch (error) {
      this.logger.error('Failed to delete video', error);
      throw error;
    }
  }

  async getDownloadUrl(id: string) {
    const video = await this.contentVideoModel.findById(id);
    
    if (!video) {
      throw new Error('Video not found');
    }

    // Generate a signed URL for downloading the original video
    const downloadUrl = await this.videoUploadService.getSignedDownloadUrl(
      video.s3Key,
      3600 // 1 hour expiry
    );

    return {
      downloadUrl,
      fileName: video.originalFileName,
      fileSize: video.fileSize,
      contentType: video.contentType,
    };
  }

  async publishVideo(id: string) {
    const video = await this.contentVideoModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isPublished: true,
          publishedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!video) {
      throw new Error('Video not found');
    }

    this.webSocketGateway.server.emit('video-published', {
      videoId: video._id,
      fileName: video.originalFileName,
    });

    return {
      message: 'Video published successfully',
      video,
    };
  }

  async unpublishVideo(id: string) {
    const video = await this.contentVideoModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isPublished: false,
          publishedAt: null,
        },
      },
      { new: true }
    );

    if (!video) {
      throw new Error('Video not found');
    }

    this.webSocketGateway.server.emit('video-unpublished', {
      videoId: video._id,
      fileName: video.originalFileName,
    });

    return {
      message: 'Video unpublished successfully',
      video,
    };
  }
}