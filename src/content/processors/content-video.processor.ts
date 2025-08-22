import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentVideo, ContentVideoDocument, VideoStatus, VideoQuality } from '../schemas/content-video.schema';
import { VideoProcessorService } from '../services/video-processor.service';
import { WebSocketGateway } from '../../websockets/websockets.gateway';
import { EmailService } from '../../email/email.service';

@Processor('video-processing')
export class ContentVideoProcessor {
  private readonly logger = new Logger(ContentVideoProcessor.name);

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly emailService: EmailService,
  ) {}

  @Process('process-video')
  async handleVideoProcessing(job: Job) {
    const { videoId, s3Key, contentType } = job.data;
    this.logger.log(`Starting processing for video ${videoId}`);

    const video = await this.contentVideoModel.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    try {
      video.status = VideoStatus.PROCESSING;
      video.processingJobId = job.id.toString();
      await video.save();

      this.webSocketGateway.server.emit('video-processing-started', {
        videoId: video._id,
        fileName: video.originalFileName,
        jobId: job.id,
      });

      const tempFilePath = await this.videoProcessorService.downloadVideoFromS3(s3Key);

      const metadata = await this.videoProcessorService.getVideoMetadata(tempFilePath);
      
      video.metadata = {
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        codec: metadata.codec,
        bitrate: metadata.bitrate,
        aspectRatio: metadata.aspectRatio,
      };
      video.duration = metadata.duration;
      await video.save();

      await job.progress(10);

      const thumbnailPath = await this.videoProcessorService.generateThumbnail(
        tempFilePath,
        videoId,
      );
      
      // Store thumbnails in video-content folder
      const thumbnailS3Key = `video-content/thumbnails/${contentType}/${videoId}_thumbnail.jpg`;
      await this.videoProcessorService.uploadToS3(thumbnailPath, thumbnailS3Key);
      video.thumbnailS3Key = thumbnailS3Key;
      await video.save();

      await job.progress(20);

      const hlsOutputDir = await this.videoProcessorService.convertToHLS(
        tempFilePath,
        videoId,
        (progress) => {
          const overallProgress = 20 + (progress * 0.7);
          job.progress(Math.round(overallProgress));
          
          this.webSocketGateway.server.emit('video-processing-progress', {
            videoId: video._id,
            progress: Math.round(overallProgress),
            stage: 'hls_conversion',
          });
        },
      );

      await job.progress(90);

      const hlsManifest = await this.videoProcessorService.uploadHLSToS3(
        hlsOutputDir,
        contentType,
        videoId,
      );

      video.hlsManifest = hlsManifest;
      video.availableQualities = hlsManifest.variantPlaylists.map(v => v.quality);
      video.status = VideoStatus.READY;
      video.processedAt = new Date();
      await video.save();

      await job.progress(100);

      await this.videoProcessorService.cleanup(tempFilePath, hlsOutputDir, thumbnailPath);

      this.webSocketGateway.server.emit('video-processing-completed', {
        videoId: video._id,
        fileName: video.originalFileName,
        status: VideoStatus.READY,
        hlsUrl: hlsManifest.masterPlaylistKey,
      });

      await this.notifyProcessingComplete(video);

      this.logger.log(`Completed processing for video ${videoId}`);
      return {
        videoId,
        status: VideoStatus.READY,
        hlsManifest,
      };
    } catch (error) {
      this.logger.error(`Failed to process video ${videoId}`, error);
      
      video.status = VideoStatus.ERROR;
      video.processingError = error.message;
      await video.save();

      this.webSocketGateway.server.emit('video-processing-failed', {
        videoId: video._id,
        fileName: video.originalFileName,
        error: error.message,
      });

      throw error;
    }
  }

  @Process('generate-additional-quality')
  async handleGenerateAdditionalQuality(job: Job) {
    const { videoId, quality, s3Key } = job.data;
    this.logger.log(`Generating ${quality} quality for video ${videoId}`);

    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const tempFilePath = await this.videoProcessorService.downloadVideoFromS3(s3Key);
      
      const outputPath = await this.videoProcessorService.generateQualityVariant(
        tempFilePath,
        quality,
        videoId,
        (progress) => {
          job.progress(progress);
        },
      );

      const variantS3Key = `content/${video.contentType}/hls/${videoId}/${quality}/index.m3u8`;
      await this.videoProcessorService.uploadToS3(outputPath, variantS3Key);

      if (!video.hlsManifest.variantPlaylists.find(v => v.quality === quality)) {
        video.hlsManifest.variantPlaylists.push({
          quality,
          playlistKey: variantS3Key,
          bandwidth: this.getBandwidthForQuality(quality),
          resolution: this.getResolutionForQuality(quality),
        });
        
        if (!video.availableQualities.includes(quality)) {
          video.availableQualities.push(quality);
        }
        
        await video.save();
      }

      await this.videoProcessorService.cleanup(tempFilePath, outputPath);

      this.logger.log(`Completed generating ${quality} quality for video ${videoId}`);
      return { videoId, quality, s3Key: variantS3Key };
    } catch (error) {
      this.logger.error(`Failed to generate ${quality} quality for video ${videoId}`, error);
      throw error;
    }
  }

  private getBandwidthForQuality(quality: VideoQuality): number {
    const bandwidthMap = {
      [VideoQuality.HD_1080P]: 5000000,
      [VideoQuality.HD_720P]: 2800000,
      [VideoQuality.SD_480P]: 1400000,
      [VideoQuality.SD_360P]: 800000,
    };
    return bandwidthMap[quality];
  }

  private getResolutionForQuality(quality: VideoQuality): string {
    const resolutionMap = {
      [VideoQuality.HD_1080P]: '1920x1080',
      [VideoQuality.HD_720P]: '1280x720',
      [VideoQuality.SD_480P]: '854x480',
      [VideoQuality.SD_360P]: '640x360',
    };
    return resolutionMap[quality];
  }

  private async notifyProcessingComplete(video: ContentVideoDocument) {
    try {
      const reviewerEmail = process.env.VIDEO_REVIEWER_EMAIL;
      if (reviewerEmail) {
        await this.emailService.sendBasicEmail(
          reviewerEmail,
          'Video Processing Completed',
          `
            <h2>Video Processing Completed</h2>
            <p>The video processing has been completed successfully.</p>
            <ul>
              <li><strong>Title:</strong> ${video.title}</li>
              <li><strong>File:</strong> ${video.originalFileName}</li>
              <li><strong>Duration:</strong> ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}</li>
              <li><strong>Available Qualities:</strong> ${video.availableQualities.join(', ')}</li>
              <li><strong>Status:</strong> Ready for publishing</li>
            </ul>
            <p>The video is now ready to be published.</p>
          `,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send processing complete notification', error);
    }
  }
}