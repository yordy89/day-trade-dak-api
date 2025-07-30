import { Injectable } from '@nestjs/common';
import { ICDNProvider } from '../cdn.interface';
import { S3_CONFIG } from '../../../config/cdn.config';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3DirectProvider implements ICDNProvider {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      region: S3_CONFIG.region,
    });
  }

  async generateSignedUrl(s3Key: string, expiresIn?: number): Promise<string> {
    const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
    
    const fullKey = s3Key.includes(S3_CONFIG.videoPrefix) 
      ? cleanKey 
      : `${S3_CONFIG.videoPrefix}/${cleanKey}`;

    const params = {
      Bucket: S3_CONFIG.bucketName,
      Key: fullKey,
      Expires: expiresIn || 3600,
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  getPublicUrl(s3Key: string): string {
    const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
    const fullKey = s3Key.includes(S3_CONFIG.videoPrefix) 
      ? cleanKey 
      : `${S3_CONFIG.videoPrefix}/${cleanKey}`;

    return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${fullKey}`;
  }

  isConfigured(): boolean {
    return !!(S3_CONFIG.bucketName && S3_CONFIG.region);
  }

  getName(): string {
    return 'S3 Direct';
  }
}