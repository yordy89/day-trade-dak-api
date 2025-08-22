import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentVideo, ContentVideoDocument, VideoStatus, ContentType } from './schemas/content-video.schema';
import { VideoUploadService } from './services/video-upload.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly videoUploadService: VideoUploadService,
    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly emailService: EmailService,
  ) {}

  async initiateMultipartUpload(
    fileName: string,
    fileSize: number,
    contentType: ContentType,
    uploadedBy: string,
  ) {
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
        s3Bucket: process.env.AWS_S3_BUCKET_NAME,
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
      throw new BadRequestException('Failed to initiate upload');
    }
  }

  async getUploadPartUrl(
    videoId: string,
    uploadId: string,
    partNumber: number,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const uploadUrl = await this.videoUploadService.getUploadPartUrl(
      video.s3Key,
      uploadId,
      partNumber,
    );

    return { uploadUrl, partNumber };
  }

  async completeMultipartUpload(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
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

      await this.notifyUploadComplete(video);

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
      throw new BadRequestException('Failed to complete upload');
    }
  }

  async abortMultipartUpload(videoId: string, uploadId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    try {
      await this.videoUploadService.abortMultipartUpload(video.s3Key, uploadId);
      
      video.status = VideoStatus.ERROR;
      video.processingError = 'Upload aborted by user';
      await video.save();

      this.webSocketGateway.server.emit('video-upload-aborted', {
        videoId: video._id,
        fileName: video.originalFileName,
      });

      return { message: 'Upload aborted successfully' };
    } catch (error) {
      this.logger.error('Failed to abort multipart upload', error);
      throw new BadRequestException('Failed to abort upload');
    }
  }

  async updateUploadProgress(
    videoId: string,
    bytesUploaded: number,
    partNumber?: number,
    etag?: string,
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (partNumber && etag) {
      const existingPartIndex = video.uploadProgress.parts.findIndex(
        p => p.partNumber === partNumber,
      );
      
      if (existingPartIndex >= 0) {
        video.uploadProgress.parts[existingPartIndex].etag = etag;
      } else {
        video.uploadProgress.parts.push({ partNumber, etag, size: 0 });
      }
    }

    video.uploadProgress.bytesUploaded = bytesUploaded;
    await video.save();

    const progress = (bytesUploaded / video.fileSize) * 100;

    this.webSocketGateway.server.emit('video-upload-progress', {
      videoId: video._id,
      fileName: video.originalFileName,
      progress: Math.round(progress),
      bytesUploaded,
      totalBytes: video.fileSize,
    });

    return { progress };
  }

  async getVideosByContentType(
    contentType: ContentType,
    status?: VideoStatus,
    page = 1,
    limit = 20,
  ) {
    const query: any = { contentType };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    
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
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVideoById(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async updateVideoMetadata(
    videoId: string,
    updates: {
      title?: string;
      description?: string;
      tags?: string[];
      isPublished?: boolean;
    },
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    Object.assign(video, updates);
    
    if (updates.isPublished && !video.publishedAt) {
      video.publishedAt = new Date();
    }

    await video.save();

    this.webSocketGateway.server.emit('video-metadata-updated', {
      videoId: video._id,
      updates,
    });

    return video;
  }

  async deleteVideo(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    try {
      await this.videoUploadService.deleteVideo(video.s3Key);
      
      if (video.thumbnailS3Key) {
        await this.videoUploadService.deleteVideo(video.thumbnailS3Key);
      }

      if (video.hlsManifest) {
        for (const variant of video.hlsManifest.variantPlaylists) {
          await this.videoUploadService.deleteVideo(variant.playlistKey);
        }
        await this.videoUploadService.deleteVideo(video.hlsManifest.masterPlaylistKey);
      }

      await this.contentVideoModel.findByIdAndDelete(videoId);

      this.webSocketGateway.server.emit('video-deleted', {
        videoId,
        fileName: video.originalFileName,
      });

      return { message: 'Video deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete video', error);
      throw new BadRequestException('Failed to delete video');
    }
  }

  private generateS3Key(contentType: ContentType, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Use video-content folder for original uploads
    const folder = this.getContentFolder(contentType, false);
    return `${folder}/${timestamp}_${sanitizedFileName}`;
  }
  
  private getContentFolder(contentType: ContentType, isHLS: boolean = false): string {
    if (isHLS) {
      // HLS converted videos go to existing folders
      switch (contentType) {
        case ContentType.DAILY_CLASSES:
          return process.env.AWS_S3_CLASS_VIDEO_FOLDER || 'hsl-daytradedak-videos/class-daily';
        case ContentType.MASTER_CLASSES:
          return process.env.AWS_S3_CLASS_COURSE_CLASS || 'hsl-daytradedak-videos/class-videos';
        case ContentType.PSICOTRADING:
          return process.env.AWS_S3_PSICOTRADING_VIDEO_FOLDER || 'hsl-daytradedak-videos/PsicoTrading';
        case ContentType.STOCKS:
          return process.env.AWS_S3_STOCK_VIDEO_FOLDER || 'stock-videos';
        default:
          return 'hsl-daytradedak-videos/general';
      }
    } else {
      // Original uploaded videos for review
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

  private async notifyUploadComplete(video: ContentVideoDocument) {
    try {
      const reviewerEmail = process.env.VIDEO_REVIEWER_EMAIL;
      if (reviewerEmail) {
        await this.emailService.sendBasicEmail(
          reviewerEmail,
          'New Video Uploaded for Review',
          `
            <h2>New Video Upload</h2>
            <p>A new video has been uploaded and is ready for review.</p>
            <ul>
              <li><strong>Title:</strong> ${video.title}</li>
              <li><strong>File:</strong> ${video.originalFileName}</li>
              <li><strong>Type:</strong> ${video.contentType}</li>
              <li><strong>Size:</strong> ${(video.fileSize / (1024 * 1024)).toFixed(2)} MB</li>
              <li><strong>Uploaded by:</strong> ${video.uploadedBy}</li>
            </ul>
            <p>Please log in to the admin panel to review this video.</p>
          `,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send upload notification email', error);
    }
  }
}