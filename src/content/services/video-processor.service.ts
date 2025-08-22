import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { VideoQuality } from '../schemas/content-video.schema';
import { Readable } from 'stream';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly tempDir: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    this.tempDir = process.env.VIDEO_TEMP_DIR || '/tmp/video-processing';
    
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create temp directory', error);
    }
  }

  async downloadVideoFromS3(s3Key: string): Promise<string> {
    const fileName = path.basename(s3Key);
    const tempFilePath = path.join(this.tempDir, `input_${Date.now()}_${fileName}`);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;
      
      const writeStream = fs.createWriteStream(tempFilePath);
      
      return new Promise((resolve, reject) => {
        stream.pipe(writeStream)
          .on('finish', () => {
            this.logger.log(`Downloaded video to ${tempFilePath}`);
            resolve(tempFilePath);
          })
          .on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to download video from S3: ${s3Key}`, error);
      throw error;
    }
  }

  async getVideoMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: videoStream ? eval(videoStream.r_frame_rate) : undefined,
          codec: videoStream?.codec_name,
          bitrate: metadata.format.bit_rate,
          aspectRatio: videoStream?.display_aspect_ratio,
          hasAudio: !!audioStream,
          audioCodec: audioStream?.codec_name,
        });
      });
    });
  }

  async generateThumbnail(videoPath: string, videoId: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${videoId}_thumbnail.jpg`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['10%'],
          filename: `${videoId}_thumbnail.jpg`,
          folder: this.tempDir,
          size: '1280x720',
        })
        .on('end', () => {
          this.logger.log(`Generated thumbnail for ${videoId}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          this.logger.error(`Failed to generate thumbnail for ${videoId}`, err);
          reject(err);
        });
    });
  }

  async convertToHLS(
    videoPath: string,
    videoId: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const outputDir = path.join(this.tempDir, `hls_${videoId}`);
    await mkdir(outputDir, { recursive: true });

    const qualities: Array<{ quality: VideoQuality; resolution: string; bitrate: string }> = [
      { quality: VideoQuality.HD_1080P, resolution: '1920x1080', bitrate: '5000k' },
      { quality: VideoQuality.HD_720P, resolution: '1280x720', bitrate: '2800k' },
      { quality: VideoQuality.SD_480P, resolution: '854x480', bitrate: '1400k' },
      { quality: VideoQuality.SD_360P, resolution: '640x360', bitrate: '800k' },
    ];

    const variantPlaylists = [];

    for (let i = 0; i < qualities.length; i++) {
      const { quality, resolution, bitrate } = qualities[i];
      const qualityDir = path.join(outputDir, quality);
      await mkdir(qualityDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const outputPath = path.join(qualityDir, 'index.m3u8');
        
        ffmpeg(videoPath)
          .outputOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls',
            `-vf scale=${resolution}`,
            `-b:v ${bitrate}`,
            '-maxrate ' + bitrate,
            '-bufsize ' + bitrate,
          ])
          .output(outputPath)
          .on('progress', (progress) => {
            if (onProgress) {
              const overallProgress = ((i / qualities.length) + (progress.percent / 100 / qualities.length)) * 100;
              onProgress(overallProgress);
            }
          })
          .on('end', () => {
            variantPlaylists.push({
              quality,
              path: outputPath,
              bandwidth: parseInt(bitrate) * 1000,
              resolution,
            });
            resolve();
          })
          .on('error', reject)
          .run();
      });
    }

    const masterPlaylist = this.createMasterPlaylist(variantPlaylists);
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
    await promisify(fs.writeFile)(masterPlaylistPath, masterPlaylist);

    this.logger.log(`Converted video ${videoId} to HLS`);
    return outputDir;
  }

  async generateQualityVariant(
    videoPath: string,
    quality: VideoQuality,
    videoId: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const outputDir = path.join(this.tempDir, `variant_${videoId}_${quality}`);
    await mkdir(outputDir, { recursive: true });

    const qualitySettings = {
      [VideoQuality.HD_1080P]: { resolution: '1920x1080', bitrate: '5000k' },
      [VideoQuality.HD_720P]: { resolution: '1280x720', bitrate: '2800k' },
      [VideoQuality.SD_480P]: { resolution: '854x480', bitrate: '1400k' },
      [VideoQuality.SD_360P]: { resolution: '640x360', bitrate: '800k' },
    };

    const { resolution, bitrate } = qualitySettings[quality];
    const outputPath = path.join(outputDir, 'index.m3u8');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-profile:v baseline',
          '-level 3.0',
          '-start_number 0',
          '-hls_time 10',
          '-hls_list_size 0',
          '-f hls',
          `-vf scale=${resolution}`,
          `-b:v ${bitrate}`,
          '-maxrate ' + bitrate,
          '-bufsize ' + bitrate,
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress) {
            onProgress(progress.percent);
          }
        })
        .on('end', () => resolve(outputDir))
        .on('error', reject)
        .run();
    });
  }

  async uploadToS3(filePath: string, s3Key: string): Promise<void> {
    try {
      const fileContent = await promisify(fs.readFile)(filePath);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentTypeFromPath(filePath),
      });

      await this.s3Client.send(command);
      this.logger.log(`Uploaded file to S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${s3Key}`, error);
      throw error;
    }
  }

  async uploadHLSToS3(
    hlsDir: string,
    contentType: string,
    videoId: string,
  ): Promise<any> {
    // Get the correct HLS folder based on content type
    const hlsFolder = this.getHLSFolder(contentType);
    const s3BaseKey = `${hlsFolder}/${videoId}`;
    const variantPlaylists = [];

    const qualities = await readdir(hlsDir);
    
    for (const quality of qualities) {
      if (quality === 'master.m3u8') continue;
      
      const qualityDir = path.join(hlsDir, quality);
      const files = await readdir(qualityDir);
      
      for (const file of files) {
        const filePath = path.join(qualityDir, file);
        const s3Key = `${s3BaseKey}/${quality}/${file}`;
        await this.uploadToS3(filePath, s3Key);
        
        if (file === 'index.m3u8') {
          variantPlaylists.push({
            quality: quality as VideoQuality,
            playlistKey: s3Key,
            bandwidth: this.getBandwidthForQuality(quality as VideoQuality),
            resolution: this.getResolutionForQuality(quality as VideoQuality),
          });
        }
      }
    }

    const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');
    const masterS3Key = `${s3BaseKey}/master.m3u8`;
    await this.uploadToS3(masterPlaylistPath, masterS3Key);

    return {
      masterPlaylistKey: masterS3Key,
      variantPlaylists,
    };
  }

  async cleanup(...paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        const stats = await stat(filePath);
        if (stats.isDirectory()) {
          const files = await readdir(filePath);
          for (const file of files) {
            await this.cleanup(path.join(filePath, file));
          }
          await rmdir(filePath);
        } else {
          await unlink(filePath);
        }
        this.logger.log(`Cleaned up: ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup: ${filePath}`, error);
      }
    }
  }

  private createMasterPlaylist(variants: any[]): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n';
    
    for (const variant of variants) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}\n`;
      playlist += `${variant.quality}/index.m3u8\n`;
    }
    
    return playlist;
  }

  private getContentTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.m3u8': 'application/x-mpegURL',
      '.ts': 'video/MP2T',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    return contentTypes[ext] || 'application/octet-stream';
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

  private getHLSFolder(contentType: string): string {
    // Map content types to their HLS folders
    switch (contentType) {
      case 'daily_classes':
        return process.env.AWS_S3_CLASS_VIDEO_FOLDER || 'hsl-daytradedak-videos/class-daily';
      case 'master_classes':
        return process.env.AWS_S3_CLASS_COURSE_CLASS || 'hsl-daytradedak-videos/class-videos';
      case 'psicotrading':
        return process.env.AWS_S3_PSICOTRADING_VIDEO_FOLDER || 'hsl-daytradedak-videos/PsicoTrading';
      case 'stocks':
        return process.env.AWS_S3_STOCK_VIDEO_FOLDER || 'stock-videos';
      default:
        return 'hsl-daytradedak-videos/general';
    }
  }
}