import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { VariableKeys } from 'src/constants';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { CustomLoggerService } from '../../logger/logger.service';

export interface VideoMetadata {
  key: string;
  signedUrl: string;
  size?: number;
  lastModified?: Date;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

@Injectable()
export class S3ServiceOptimized {
  private readonly logger = new Logger(S3ServiceOptimized.name);
  private s3: S3Client;
  private bucketName: string;
  private useCloudFront: boolean;
  private cloudFrontDomain: string;
  private keyPairId: string;
  private privateKeyPath: string;
  private privateKeyCache: string | null = null;

  // Cache for signed URLs
  private signedUrlCache = new Map<
    string,
    { url: string; expiresAt: number }
  >();

  // Constants for optimization
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly SIGNED_URL_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours in ms
  private readonly CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.initializeS3Client();
    this.startCacheCleanup();
  }

  private initializeS3Client(): void {
    try {
      const region = this.configService.get<string>('AWS_REGION');
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );

      if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error('Missing required AWS configuration');
      }

      this.s3 = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: this.MAX_RETRIES,
        requestHandler: {
          requestTimeout: 30000, // 30 seconds timeout
        },
      });

      this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
      this.cloudFrontDomain =
        this.configService.get<string>('CLOUDFRONT_DOMAIN');
      this.useCloudFront = !!this.cloudFrontDomain;
      this.keyPairId = this.configService.get<string>('CLOUDFRONT_KEY_PAIR_ID');
      // Look for the PEM file in the project root
      this.privateKeyPath = path.resolve(
        process.cwd(),
        'pk-APKAW5BDRBYFYKXAVZP5.pem',
      );

      if (!this.bucketName) {
        throw new Error('S3 bucket name is not configured');
      }

      this.logger.log('S3 service initialized successfully');
      this.customLogger.log('S3 service initialized', 'S3Service');
    } catch (error) {
      this.logger.error('Failed to initialize S3 service', error);
      this.customLogger.error(
        'S3 initialization failed',
        error.stack,
        'S3Service',
      );
      throw new InternalServerErrorException(
        'Failed to initialize storage service',
      );
    }
  }

  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      // Validate file
      this.validateImageFile(file);

      const folderPath = this.configService.get<string>(
        'AWS_S3_PROFILE_IMAGE_FOLDER',
      );
      if (!folderPath) {
        throw new Error('Profile image folder not configured');
      }

      // Generate unique key with sanitized filename
      const sanitizedFilename = this.sanitizeFilename(file.originalname);
      const fileKey = `${folderPath}/${userId}/${uuidv4()}-${sanitizedFilename}`;

      // Optimize image before upload (optional - requires sharp)
      // const optimizedBuffer = await this.optimizeImage(file.buffer);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      };

      // Upload with retry logic
      await this.uploadWithRetry(uploadParams);

      const url = this.useCloudFront
        ? `https://${this.cloudFrontDomain}/${fileKey}`
        : `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${fileKey}`;

      const duration = Date.now() - startTime;
      this.customLogger.logPerformanceMetric(
        's3_upload_profile_image',
        duration,
      );
      this.customLogger.logBusinessEvent('profile_image_uploaded', {
        userId,
        fileKey,
        size: file.size,
      });

      return {
        url,
        key: fileKey,
        size: file.size,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.customLogger.error(
        `Failed to upload profile image for user ${userId}`,
        error.stack,
        'S3Service',
      );
      this.customLogger.logPerformanceMetric(
        's3_upload_profile_image_failed',
        duration,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to upload profile image');
    }
  }

  async listVideos(key: string): Promise<VideoMetadata[]> {
    const startTime = Date.now();

    try {
      // Map the key to the actual config path
      let configPath: string;
      switch (key) {
        case 'AWS_S3_CLASS_VIDEO_FOLDER':
          configPath = 'aws.s3.classFolder';
          break;
        case 'AWS_S3_MENTORSHIP_FOLDER':
          configPath = 'aws.s3.mentorshipFolder';
          break;
        case 'AWS_S3_STOCK_VIDEO_FOLDER':
          configPath = 'aws.s3.stockFolder';
          break;
        case 'AWS_S3_PSICOTRADING_VIDEO_FOLDER':
          configPath = 'aws.s3.psicotradingFolder';
          break;
        case 'AWS_S3_CURSO_1_FOLDER':
          configPath = 'aws.s3.curso1Folder';
          break;
        case 'AWS_S3_CLASS_COURSE_CLASS':
          configPath = 'aws.s3.classesFolder';
          break;
        default:
          // Try direct lookup for backwards compatibility
          configPath = key;
      }

      const prefix =
        this.configService.get<string>(configPath) ||
        this.configService.get<string>(key);

      if (!prefix) {
        this.customLogger.error(
          `Invalid video folder key: ${key}, configPath: ${configPath}`,
          '',
          'S3Service',
        );
        throw new BadRequestException(`Invalid video folder key: ${key}`);
      }

      this.customLogger.log(
        `Listing videos for key: ${key}, prefix: ${prefix}`,
        'S3Service',
      );

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${prefix}/`,
        MaxKeys: 1000, // Optimize by limiting results
      });

      this.customLogger.log(
        `Executing S3 ListObjectsV2 - Bucket: ${this.bucketName}, Prefix: ${prefix}/`,
        'S3Service',
      );

      const { Contents } = await this.s3.send(command);

      this.customLogger.log(
        `S3 response - Found ${Contents?.length || 0} objects`,
        'S3Service',
      );

      if (!Contents || Contents.length === 0) {
        this.customLogger.log(
          `No videos found for prefix: ${prefix}`,
          'S3Service',
        );
        return [];
      }

      // Filter and process videos in parallel with batching
      const videoFiles = Contents.filter(
        (file) =>
          file.Key &&
          !file.Key.endsWith('/') &&
          (file.Key.endsWith('.mp4') || file.Key.endsWith('.mov')),
      );

      // Batch process to avoid overwhelming the system
      const batchSize = 10;
      const videos: VideoMetadata[] = [];

      for (let i = 0; i < videoFiles.length; i += batchSize) {
        const batch = videoFiles.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const signedUrl = await this.getSignedUrl(file.Key!);
              return {
                key: file.Key!,
                signedUrl,
                size: file.Size,
                lastModified: file.LastModified,
              };
            } catch (error) {
              this.logger.error(
                `Failed to get signed URL for ${file.Key}`,
                error,
              );
              return null;
            }
          }),
        );

        videos.push(
          ...(batchResults.filter((v) => v !== null) as VideoMetadata[]),
        );
      }

      // Apply specific sorting for class videos
      let processedVideos = videos;
      if (key === VariableKeys.AWS_ClASS_FOLDER) {
        processedVideos = this.processClassVideos(videos);
      }

      const duration = Date.now() - startTime;
      this.customLogger.logPerformanceMetric('s3_list_videos', duration);
      this.customLogger.log(
        `Listed ${processedVideos.length} videos for key: ${key}`,
        'S3Service',
      );

      return processedVideos;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.customLogger.error(
        `Failed to list videos for key: ${key}`,
        error.stack,
        'S3Service',
      );
      this.customLogger.logPerformanceMetric('s3_list_videos_failed', duration);

      throw new InternalServerErrorException('Failed to retrieve video list');
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Check cache first
    const cached = this.signedUrlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    try {
      let signedUrl: string;

      if (this.useCloudFront) {
        signedUrl = await this.getCloudFrontSignedUrl(key);
      } else {
        signedUrl = await this.getS3SignedUrl(key);
      }

      // Cache the signed URL
      this.signedUrlCache.set(key, {
        url: signedUrl,
        expiresAt: Date.now() + this.SIGNED_URL_EXPIRY - 60 * 60 * 1000, // Expire 1 hour before actual expiry
      });

      return signedUrl;
    } catch (error) {
      this.customLogger.error(
        `Failed to generate signed URL for key: ${key}`,
        error.stack,
        'S3Service',
      );
      throw new InternalServerErrorException('Failed to generate access URL');
    }
  }

  private async getCloudFrontSignedUrl(key: string): Promise<string> {
    try {
      // Load private key once and cache it
      if (!this.privateKeyCache) {
        this.privateKeyCache = await fs.readFile(this.privateKeyPath, 'utf8');
      }

      const fullUrl = `https://${this.cloudFrontDomain}/${key}`;
      const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

      return getCloudFrontSignedUrl({
        url: fullUrl,
        keyPairId: this.keyPairId,
        privateKey: this.privateKeyCache,
        dateLessThan: new Date(expires * 1000).toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to generate CloudFront signed URL', error);
      throw error;
    }
  }

  private async getS3SignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseCacheControl: 'max-age=3600',
    });

    return getS3SignedUrl(this.s3, command, {
      expiresIn: 12 * 60 * 60, // 12 hours
    });
  }

  private async uploadWithRetry(params: any, attempt = 1): Promise<void> {
    try {
      await this.s3.send(new PutObjectCommand(params));
    } catch (error) {
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        this.logger.warn(`Upload attempt ${attempt} failed, retrying...`);
        await this.delay(this.RETRY_DELAY * attempt);
        return this.uploadWithRetry(params, attempt + 1);
      }
      throw error;
    }
  }

  private validateImageFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100); // Limit length
  }

  private processClassVideos(videos: VideoMetadata[]): VideoMetadata[] {
    return videos
      .map((video) => {
        const filename = video.key.split('/').pop()!;
        const dateString = filename.replace('.mp4', '').replace(/:/g, '-');

        return {
          ...video,
          date: new Date(dateString),
        };
      })
      .sort((a, b) => (b as any).date.getTime() - (a as any).date.getTime())
      .slice(0, 10) // Get only the latest 10 videos
      .map(({ key, signedUrl, size, lastModified }) => ({
        key,
        signedUrl,
        size,
        lastModified,
      }));
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof S3ServiceException) {
      const retryableCodes = [
        'RequestTimeout',
        'ServiceUnavailable',
        'ThrottlingException',
      ];
      return retryableCodes.includes(error.name);
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.signedUrlCache.entries()) {
        if (value.expiresAt < now) {
          this.signedUrlCache.delete(key);
        }
      }
      this.customLogger.debug(
        `Cleaned up ${this.signedUrlCache.size} cached URLs`,
        'S3Service',
      );
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  // Get video metadata from S3 object
  async getVideoMetadata(key: string): Promise<any> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3.send(command);

      // Extract custom metadata (x-amz-meta-* headers)
      const metadata: any = {};
      if (response.Metadata) {
        // S3 custom metadata comes back without the x-amz-meta- prefix
        metadata.duration = response.Metadata.duration
          ? parseInt(response.Metadata.duration)
          : undefined;
        metadata.title = response.Metadata.title;
        metadata.description = response.Metadata.description;
      }

      return metadata;
    } catch (error) {
      this.logger.warn(`Failed to get metadata for ${key}:`, error);
      return null;
    }
  }

  // Update video metadata in S3
  async updateVideoMetadata(
    key: string,
    metadata: { duration?: number; title?: string; description?: string },
  ): Promise<void> {
    try {
      // Copy object to itself with new metadata
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${key}`,
        Key: key,
        Metadata: {
          ...(metadata.duration && { duration: metadata.duration.toString() }),
          ...(metadata.title && { title: metadata.title }),
          ...(metadata.description && { description: metadata.description }),
        },
        MetadataDirective: 'REPLACE',
      });

      await this.s3.send(copyCommand);
      this.logger.log(`Updated metadata for ${key}`);
    } catch (error) {
      this.logger.error(`Failed to update metadata for ${key}:`, error);
      throw new InternalServerErrorException('Failed to update video metadata');
    }
  }
}
