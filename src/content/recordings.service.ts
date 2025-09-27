import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

interface Recording {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  type: 'raw' | 'edited';
}

@Injectable()
export class RecordingsService {
  private s3: S3Client;
  private recordingsBucket: string;
  private rawRecordingsPrefix: string = '';  // LiveKit recordings are at root level
  private editedRecordingsPrefix: string = 'edited-recordings/';

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    // Use the recordings bucket from environment variable
    this.recordingsBucket = this.configService.get<string>('AWS_S3_RECORDING_BUCKET_NAME', 'day-trade-dak-recordings');
    console.log('RecordingsService initialized with bucket:', this.recordingsBucket);
  }

  async listRecordings(type: 'raw' | 'edited' | 'all' = 'raw'): Promise<Recording[]> {
    const recordings: Recording[] = [];

    if (type === 'raw' || type === 'all') {
      const rawRecordings = await this.listRecordingsByPrefix(this.rawRecordingsPrefix, 'raw');
      recordings.push(...rawRecordings);
    }

    if (type === 'edited' || type === 'all') {
      const editedRecordings = await this.listRecordingsByPrefix(this.editedRecordingsPrefix, 'edited');
      recordings.push(...editedRecordings);
    }

    // Sort by lastModified date, most recent first
    return recordings.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  private async listRecordingsByPrefix(prefix: string, type: 'raw' | 'edited'): Promise<Recording[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.recordingsBucket,
      Prefix: prefix,
      MaxKeys: 1000,
    });

    try {
      console.log(`Listing recordings from bucket: ${this.recordingsBucket} with prefix: "${prefix}"`);
      const response = await this.s3.send(command);
      const { Contents } = response;

      if (!Contents || Contents.length === 0) {
        console.log(`No recordings found with prefix: "${prefix}"`);
        return [];
      }

      console.log(`Found ${Contents.length} files with prefix: "${prefix}"`);

      const recordings = Contents
        .filter((file) => {
          // Filter out directories
          if (!file.Key || file.Key.endsWith('/')) return false;

          // Define video extensions
          const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg'];

          // Check if file has a video extension
          const isVideoFile = videoExtensions.some(ext => file.Key!.toLowerCase().endsWith(ext));

          // For raw recordings (no prefix), only include video files at root
          if (type === 'raw' && prefix === '') {
            // Don't include files that are in subdirectories
            if (file.Key.includes('/')) return false;
            return isVideoFile;
          }

          // For edited recordings, only include video files
          return isVideoFile;
        })
        .map((file) => ({
          key: file.Key!,
          name: this.extractFileName(file.Key!),
          size: file.Size || 0,
          lastModified: file.LastModified || new Date(),
          type,
        }));

      console.log(`Returning ${recordings.length} ${type} recordings`);
      return recordings;
    } catch (error) {
      console.error('Error listing recordings:', error);
      throw new BadRequestException(`Failed to list recordings: ${error.message}`);
    }
  }

  private extractFileName(key: string): string {
    // Remove prefix and return just the file name
    const parts = key.split('/');
    const fileName = parts[parts.length - 1];

    // If it's a LiveKit recording, try to extract meaningful information
    // LiveKit recordings typically have format: room-name_timestamp.mp4
    if (fileName.includes('_')) {
      const [roomName, ...rest] = fileName.split('_');
      return fileName; // Keep full name for now, can be enhanced later
    }

    return fileName;
  }

  async getDownloadUrl(key: string): Promise<{ url: string; fileName: string }> {
    // Verify the object exists
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.recordingsBucket,
        Key: key,
      }));
    } catch (error) {
      throw new NotFoundException('Recording not found');
    }

    const command = new GetObjectCommand({
      Bucket: this.recordingsBucket,
      Key: key,
    });

    const url = await getS3SignedUrl(this.s3, command, {
      expiresIn: 3600, // 1 hour
    });

    return {
      url,
      fileName: this.extractFileName(key),
    };
  }

  async deleteRecording(key: string): Promise<{ success: boolean; message: string }> {
    // Verify the object exists
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.recordingsBucket,
        Key: key,
      }));
    } catch (error) {
      throw new NotFoundException('Recording not found');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.recordingsBucket,
      Key: key,
    });

    try {
      await this.s3.send(command);
      return {
        success: true,
        message: 'Recording deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw new BadRequestException('Failed to delete recording');
    }
  }

  async uploadEditedRecording(
    file: Express.Multer.File,
    name: string,
    uploadedBy: string,
    originalRecordingKey?: string,
  ): Promise<{ success: boolean; key: string; message: string }> {
    // Sanitize the name and add extension if not present
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const extension = file.originalname.split('.').pop() || 'mp4';
    const fileName = sanitizedName.endsWith(`.${extension}`)
      ? sanitizedName
      : `${sanitizedName}.${extension}`;

    // Create a unique key for the edited recording
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${this.editedRecordingsPrefix}${timestamp}_${fileName}`;

    const uploadParams = {
      Bucket: this.recordingsBucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        uploadedBy,
        uploadDate: new Date().toISOString(),
        originalRecording: originalRecordingKey || 'none',
        originalName: file.originalname,
      },
    };

    try {
      await this.s3.send(new PutObjectCommand(uploadParams));

      return {
        success: true,
        key,
        message: 'Edited recording uploaded successfully',
      };
    } catch (error) {
      console.error('Error uploading edited recording:', error);
      throw new BadRequestException('Failed to upload edited recording');
    }
  }

  async getWatchUrl(key: string): Promise<{ url: string; type: string }> {
    // Verify the object exists
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.recordingsBucket,
        Key: key,
      }));
    } catch (error) {
      throw new NotFoundException('Recording not found');
    }

    const command = new GetObjectCommand({
      Bucket: this.recordingsBucket,
      Key: key,
    });

    const url = await getS3SignedUrl(this.s3, command, {
      expiresIn: 7200, // 2 hours for watching
    });

    // Determine video type based on extension
    const extension = key.split('.').pop()?.toLowerCase();
    let type = 'video/mp4'; // default

    if (extension === 'webm') {
      type = 'video/webm';
    } else if (extension === 'mov') {
      type = 'video/quicktime';
    } else if (extension === 'avi') {
      type = 'video/x-msvideo';
    } else if (extension === 'mkv') {
      type = 'video/x-matroska';
    }

    return { url, type };
  }

  async getRecordingsStats(): Promise<{
    totalRecordings: number;
    rawRecordings: number;
    editedRecordings: number;
    totalSize: number;
  }> {
    const allRecordings = await this.listRecordings('all');

    const stats = allRecordings.reduce(
      (acc, recording) => {
        acc.totalRecordings++;
        acc.totalSize += recording.size;

        if (recording.type === 'raw') {
          acc.rawRecordings++;
        } else {
          acc.editedRecordings++;
        }

        return acc;
      },
      {
        totalRecordings: 0,
        rawRecordings: 0,
        editedRecordings: 0,
        totalSize: 0,
      },
    );

    return stats;
  }
}