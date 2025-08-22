import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class VideoUploadService {
  private readonly logger = new Logger(VideoUploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
  }

  async initiateMultipartUpload(s3Key: string, fileName: string) {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: this.getContentType(fileName),
        Metadata: {
          originalFileName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      const response = await this.s3Client.send(command);
      
      const uploadUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
        { expiresIn: 86400 }, // 24 hours
      );

      this.logger.log(`Initiated multipart upload for ${s3Key}, uploadId: ${response.UploadId}`);

      return {
        uploadId: response.UploadId,
        uploadUrl,
      };
    } catch (error) {
      this.logger.error('Failed to initiate multipart upload', error);
      throw error;
    }
  }

  async getUploadPartUrl(
    s3Key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour per part
      });

      return uploadUrl;
    } catch (error) {
      this.logger.error(`Failed to get upload part URL for part ${partNumber}`, error);
      throw error;
    }
  }

  async completeMultipartUpload(
    s3Key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    try {
      const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts.map(part => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      });

      const response = await this.s3Client.send(command);
      this.logger.log(`Completed multipart upload for ${s3Key}`);
      
      return response;
    } catch (error) {
      this.logger.error('Failed to complete multipart upload', error);
      throw error;
    }
  }

  async abortMultipartUpload(s3Key: string, uploadId: string) {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);
      this.logger.log(`Aborted multipart upload for ${s3Key}`);
    } catch (error) {
      this.logger.error('Failed to abort multipart upload', error);
      throw error;
    }
  }

  async deleteVideo(s3Key: string) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Deleted object ${s3Key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${s3Key}`, error);
      throw error;
    }
  }

  async getVideoMetadata(s3Key: string) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      return {
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get object metadata for ${s3Key}`, error);
      throw error;
    }
  }

  async getSignedDownloadUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${s3Key}`, error);
      throw error;
    }
  }

  private getContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const contentTypes: Record<string, string> = {
      mov: 'video/quicktime',
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      m3u8: 'application/x-mpegURL',
      ts: 'video/MP2T',
    };

    return contentTypes[extension] || 'application/octet-stream';
  }
}