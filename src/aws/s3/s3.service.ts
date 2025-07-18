import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { VariableKeys } from 'src/constants';
import * as fs from 'fs';
import * as path from 'path';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucketName: string;
  private useCloudFront: boolean;

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
    this.useCloudFront = !!this.configService.get<string>('CLOUDFRONT_DOMAIN');
  }

  // async uploadProfileImage(
  //   file: Express.Multer.File,
  //   userId: string,
  // ): Promise<string> {
  //   const folderPath = this.configService.get<string>(
  //     'AWS_S3_PROFILE_IMAGE_FOLDER',
  //   );
  //   const fileKey = `${folderPath}/${userId}/${uuidv4()}-${file.originalname}`;

  //   const uploadParams = {
  //     Bucket: this.bucketName,
  //     Key: fileKey,
  //     Body: file.buffer,
  //     ContentType: file.mimetype,
  //   };

  //   await this.s3.send(new PutObjectCommand(uploadParams));

  //   return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${fileKey}`;
  // }

  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const folderPath = this.configService.get<string>(
      'AWS_S3_PROFILE_IMAGE_FOLDER',
    );
    const cloudFrontDomain =
      this.configService.get<string>('CLOUDFRONT_DOMAIN');
    const fileKey = `${folderPath}/${userId}/${uuidv4()}-${file.originalname}`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(uploadParams));

    // Return CloudFront URL instead of S3 URL
    return `https://${cloudFrontDomain}/${fileKey}`;
  }

  async listVideos(key: string): Promise<{ key: string; signedUrl: string }[]> {
    const prefix = this.configService.get<string>(key);
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${prefix}/`,
    });

    const { Contents } = await this.s3.send(command);

    if (!Contents) return [];

    let videos = await Promise.all(
      Contents.filter((file) => file.Key && !file.Key.endsWith('/')).map(
        async (file) => {
          const signedUrl = await this.getSignedUrl(file.Key);
          return { key: file.Key, signedUrl };
        },
      ),
    );

    if (key === VariableKeys.AWS_ClASS_FOLDER) {
      videos = videos
        .map((video) => ({
          ...video,
          date: new Date(
            video.key.split('/').pop()!.replace('.mp4', '').replace(/:/g, '-'),
          ),
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10)
        .map(({ key, signedUrl }) => ({ key, signedUrl }));
    }

    return videos;
  }

  async getSignedUrl(key: string): Promise<string> {
    if (this.useCloudFront) {
      const cloudFrontDomain =
        this.configService.get<string>('CLOUDFRONT_DOMAIN');
      const keyPairId = this.configService.get<string>(
        'CLOUDFRONT_KEY_PAIR_ID',
      );
      const privateKey = fs.readFileSync(
        path.resolve(__dirname, '../../../pk-APKAW5BDRBYFYKXAVZP5.pem'),
        'utf8',
      );

      const fullUrl = `https://${cloudFrontDomain}/${key}`;
      const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 12;

      const signedUrl = getCloudFrontSignedUrl({
        url: fullUrl,
        keyPairId,
        privateKey,
        dateLessThan: new Date(expires * 1000).toISOString(),
      });

      return signedUrl;
    }

    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getS3SignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}
