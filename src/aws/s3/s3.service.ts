import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
  }
  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const folderPath = this.configService.get<string>(
      'AWS_S3_PROFILE_IMAGE_FOLDER',
    );
    const fileKey = `${folderPath}/${userId}/${uuidv4()}-${file.originalname}`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(uploadParams));

    return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${fileKey}`;
  }

  async listVideos(): Promise<{ key: string; signedUrl: string }[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${this.configService.get<string>('AWS_S3_CLASS_VIDEO_FOLDER')}/`,
    });

    const { Contents } = await this.s3.send(command);

    if (!Contents) return [];

    const videos = await Promise.all(
      Contents.filter((file) => file.Key && !file.Key.endsWith('/')).map(
        async (file) => {
          const signedUrl = await this.getSignedUrl(file.Key);
          return { key: file.Key, signedUrl };
        },
      ),
    );

    return videos;
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 🔹 1-hour expiry
  }
}
