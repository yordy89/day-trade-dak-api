/**
 * CDN Provider Interface for API
 */
export interface ICDNProvider {
  /**
   * Generate a signed/authenticated URL for protected content
   * @param s3Key The S3 object key
   * @param expiresIn Expiry time in seconds
   */
  generateSignedUrl(s3Key: string, expiresIn?: number): Promise<string>;

  /**
   * Get public URL (if content is public)
   */
  getPublicUrl(s3Key: string): string;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Get provider name
   */
  getName(): string;
}

export interface ISignedUrlOptions {
  expiresIn?: number; // seconds
  ipAddress?: string; // IP restriction
  responseContentDisposition?: string; // Force download with filename
}