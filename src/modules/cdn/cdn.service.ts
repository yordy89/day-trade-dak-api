import { Injectable, OnModuleInit } from '@nestjs/common';
import { CDN_PROVIDER } from '../../config/cdn.config';
import { ICDNProvider } from './cdn.interface';
import { CloudFrontProvider } from './providers/cloudfront.provider';
import { BunnyCDNProvider } from './providers/bunnycdn.provider';
import { S3DirectProvider } from './providers/s3-direct.provider';

@Injectable()
export class CDNService implements OnModuleInit {
  private provider: ICDNProvider;

  onModuleInit() {
    this.initializeProvider();
    console.log(`CDN Service initialized with provider: ${this.provider.getName()}`);
    console.log(`Provider configured: ${this.provider.isConfigured()}`);
  }

  private initializeProvider() {
    switch (CDN_PROVIDER) {
      case 'cloudfront':
        this.provider = new CloudFrontProvider();
        break;
      case 'bunnycdn':
        this.provider = new BunnyCDNProvider();
        break;
      case 's3-direct':
        this.provider = new S3DirectProvider();
        break;
      default:
        console.warn(`Unknown CDN provider: ${CDN_PROVIDER}, falling back to S3 Direct`);
        this.provider = new S3DirectProvider();
    }
  }

  /**
   * Generate a signed URL for protected video content
   */
  async generateVideoUrl(videoPath: string, expiresIn?: number): Promise<string> {
    try {
      return await this.provider.generateSignedUrl(videoPath, expiresIn);
    } catch (error) {
      console.error(`Failed to generate signed URL with ${this.provider.getName()}:`, error);
      
      // Fallback to S3 direct if current provider fails
      if (CDN_PROVIDER !== 's3-direct') {
        console.log('Falling back to S3 direct signed URLs');
        const s3Provider = new S3DirectProvider();
        return s3Provider.generateSignedUrl(videoPath, expiresIn);
      }
      
      throw error;
    }
  }

  /**
   * Get public URL (for non-protected content)
   */
  getPublicUrl(path: string): string {
    return this.provider.getPublicUrl(path);
  }

  /**
   * Get current CDN provider info
   */
  getProviderInfo() {
    return {
      name: this.provider.getName(),
      configured: this.provider.isConfigured(),
      type: CDN_PROVIDER,
    };
  }
}