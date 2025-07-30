import { Injectable } from '@nestjs/common';
import { ICDNProvider } from '../cdn.interface';
import { CDN_CONFIGS, S3_CONFIG } from '../../../config/cdn.config';
import * as AWS from 'aws-sdk';
import { readFileSync } from 'fs';

@Injectable()
export class CloudFrontProvider implements ICDNProvider {
  private cloudFront: AWS.CloudFront.Signer;
  private config = CDN_CONFIGS.cloudfront;

  constructor() {
    if (this.config.privateKeyPath && this.config.keyPairId) {
      try {
        const privateKey = readFileSync(this.config.privateKeyPath, 'utf8');
        this.cloudFront = new AWS.CloudFront.Signer(
          this.config.keyPairId,
          privateKey
        );
      } catch (error) {
        console.error('Failed to initialize CloudFront signer:', error);
      }
    }
  }

  async generateSignedUrl(s3Key: string, expiresIn?: number): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('CloudFront is not properly configured for signed URLs');
    }

    const url = this.getPublicUrl(s3Key);
    const expiry = Math.floor(Date.now() / 1000) + (expiresIn || this.config.defaultExpiry);

    const signedUrl = this.cloudFront.getSignedUrl({
      url,
      expires: expiry,
    });

    return signedUrl;
  }

  getPublicUrl(s3Key: string): string {
    // Remove leading slash if present
    const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
    
    // If it's already a full S3 key, use it
    // Otherwise, prepend the video prefix
    const fullKey = s3Key.includes(S3_CONFIG.videoPrefix) 
      ? cleanKey 
      : `${S3_CONFIG.videoPrefix}/${cleanKey}`;

    return `${this.config.protocol}://${this.config.domain}/${fullKey}`;
  }

  isConfigured(): boolean {
    return !!(this.config.keyPairId && this.config.privateKeyPath && this.cloudFront);
  }

  getName(): string {
    return 'CloudFront';
  }
}