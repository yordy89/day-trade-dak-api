import { Injectable } from '@nestjs/common';
import { ICDNProvider } from '../cdn.interface';
import { CDN_CONFIGS, S3_CONFIG } from '../../../config/cdn.config';
import * as crypto from 'crypto';

@Injectable()
export class BunnyCDNProvider implements ICDNProvider {
  private config = CDN_CONFIGS.bunnycdn;

  async generateSignedUrl(s3Key: string, expiresIn?: number): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('BunnyCDN is not properly configured for token authentication');
    }

    const url = this.getPublicUrl(s3Key);
    const expires = Math.floor(Date.now() / 1000) + (expiresIn || this.config.defaultExpiry);
    
    // BunnyCDN token authentication
    // Format: sha256(auth_key + url_path + expires)
    const urlPath = new URL(url).pathname;
    const authString = this.config.authenticationKey + urlPath + expires;
    
    const token = crypto
      .createHash('sha256')
      .update(authString)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Add token and expiry to URL
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${token}&expires=${expires}`;
  }

  getPublicUrl(s3Key: string): string {
    // BunnyCDN Pull Zone will mirror your S3 structure
    // So we use the same path structure as S3
    const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
    
    const fullKey = s3Key.includes(S3_CONFIG.videoPrefix) 
      ? cleanKey 
      : `${S3_CONFIG.videoPrefix}/${cleanKey}`;

    return `${this.config.protocol}://${this.config.domain}/${fullKey}`;
  }

  isConfigured(): boolean {
    return !!(this.config.domain && this.config.authenticationKey);
  }

  getName(): string {
    return 'BunnyCDN';
  }
}