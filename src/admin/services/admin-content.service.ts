import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentVideo, ContentVideoDocument, VideoStatus, ContentType } from '../../content/schemas/content-video.schema';
import { ContentService } from '../../content/content.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly contentService: ContentService,
    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
  ) {}

  async initiateVideoUpload(
    fileName: string,
    fileSize: number,
    contentType: ContentType,
    user: any,
  ) {
    const uploadedBy = `${user.firstName} ${user.lastName} (Admin)`;
    return this.contentService.initiateMultipartUpload(
      fileName,
      fileSize,
      contentType,
      uploadedBy,
    );
  }

  async getUploadPartUrl(
    videoId: string,
    uploadId: string,
    partNumber: number,
  ) {
    return this.contentService.getUploadPartUrl(
      videoId,
      uploadId,
      partNumber,
    );
  }

  async completeUpload(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    return this.contentService.completeMultipartUpload(
      videoId,
      uploadId,
      parts,
    );
  }

  async abortUpload(videoId: string, uploadId: string) {
    return this.contentService.abortMultipartUpload(videoId, uploadId);
  }

  async getVideos(filters: {
    contentType?: ContentType;
    status?: VideoStatus;
    page: number;
    limit: number;
    search?: string;
  }) {
    const query: any = {};
    
    if (filters.contentType) {
      query.contentType = filters.contentType;
    }
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { originalFileName: { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [new RegExp(filters.search, 'i')] } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    
    const [videos, total] = await Promise.all([
      this.contentVideoModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .exec(),
      this.contentVideoModel.countDocuments(query),
    ]);

    return {
      videos,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getVideoById(videoId: string) {
    return this.contentService.getVideoById(videoId);
  }

  async updateVideo(
    videoId: string,
    updates: {
      title?: string;
      description?: string;
      tags?: string[];
      contentType?: ContentType;
      isPublished?: boolean;
    },
  ) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    if (updates.contentType && updates.contentType !== video.contentType) {
      const oldS3Key = video.s3Key;
      const newS3Key = oldS3Key.replace(
        `/content/${video.contentType}/`,
        `/content/${updates.contentType}/`,
      );
      
      video.s3Key = newS3Key;
      video.contentType = updates.contentType;
    }

    return this.contentService.updateVideoMetadata(videoId, updates);
  }

  async deleteVideo(videoId: string) {
    return this.contentService.deleteVideo(videoId);
  }

  async publishVideo(videoId: string) {
    return this.contentService.updateVideoMetadata(videoId, {
      isPublished: true,
    });
  }

  async unpublishVideo(videoId: string) {
    return this.contentService.updateVideoMetadata(videoId, {
      isPublished: false,
    });
  }

  async reprocessVideo(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    video.status = VideoStatus.PROCESSING;
    await video.save();

    const job = await this.videoQueue.add('process-video', {
      videoId: video._id.toString(),
      s3Key: video.s3Key,
      contentType: video.contentType,
    });

    return {
      message: 'Video reprocessing started',
      jobId: job.id,
      videoId,
    };
  }

  async getVideoDownloadUrl(videoId: string) {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Generate a presigned URL directly using AWS SDK
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: video.s3Key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      downloadUrl,
      fileName: video.originalFileName,
      fileSize: video.fileSize,
    };
  }

  async getContentStatistics() {
    const [
      totalVideos,
      publishedVideos,
      processingVideos,
      errorVideos,
      totalSize,
      videosByType,
      videosByStatus,
    ] = await Promise.all([
      this.contentVideoModel.countDocuments(),
      this.contentVideoModel.countDocuments({ isPublished: true }),
      this.contentVideoModel.countDocuments({ status: VideoStatus.PROCESSING }),
      this.contentVideoModel.countDocuments({ status: VideoStatus.ERROR }),
      this.contentVideoModel.aggregate([
        { $group: { _id: null, total: { $sum: '$fileSize' } } },
      ]),
      this.contentVideoModel.aggregate([
        { $group: { _id: '$contentType', count: { $sum: 1 } } },
      ]),
      this.contentVideoModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      overview: {
        totalVideos,
        publishedVideos,
        processingVideos,
        errorVideos,
        totalStorageUsedGB: totalSize[0]?.total
          ? (totalSize[0].total / (1024 * 1024 * 1024)).toFixed(2)
          : 0,
      },
      videosByType: videosByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      videosByStatus: videosByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }

  async getProcessingQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.videoQueue.getWaitingCount(),
      this.videoQueue.getActiveCount(),
      this.videoQueue.getCompletedCount(),
      this.videoQueue.getFailedCount(),
      this.videoQueue.getDelayedCount(),
    ]);

    const jobs = await this.videoQueue.getJobs(['waiting', 'active']);
    
    return {
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      activeJobs: jobs.map(job => ({
        id: job.id,
        data: job.data,
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        createdAt: new Date(job.timestamp),
      })),
    };
  }
}