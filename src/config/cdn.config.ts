/**
 * CDN Configuration for API
 * Handles signed URL generation for different CDN providers
 */

export type CDNProvider = 'cloudfront' | 'bunnycdn' | 'cloudflare' | 's3-direct';

// CDN Provider - can be changed via environment variable
export const CDN_PROVIDER: CDNProvider = (process.env.CDN_PROVIDER as CDNProvider) || 'cloudfront';

// CDN Configurations
export const CDN_CONFIGS = {
  cloudfront: {
    domain: process.env.CLOUDFRONT_DOMAIN || 'd3m2tao2a2xtek.cloudfront.net',
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || '',
    privateKeyPath: process.env.CLOUDFRONT_PRIVATE_KEY_PATH || '',
    protocol: 'https',
    defaultExpiry: 3600, // 1 hour
  },
  bunnycdn: {
    // BunnyCDN Pull Zone connected to your S3 bucket
    domain: process.env.BUNNYCDN_DOMAIN || 'youraccount.b-cdn.net',
    // Authentication key for token generation
    authenticationKey: process.env.BUNNYCDN_AUTHENTICATION_KEY || '',
    protocol: 'https',
    defaultExpiry: 3600,
  },
  cloudflare: {
    domain: process.env.CLOUDFLARE_STREAM_DOMAIN || '',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    authToken: process.env.CLOUDFLARE_AUTH_TOKEN || '',
    protocol: 'https',
    defaultExpiry: 3600,
  },
  's3-direct': {
    // Fallback to direct S3 signed URLs
    bucketName: process.env.S3_BUCKET_NAME || '',
    region: process.env.AWS_REGION || 'us-east-1',
    defaultExpiry: 3600,
  }
};

// S3 Configuration (source of truth for all CDNs)
export const S3_CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME || 'day-trade-dak-resources',
  region: process.env.AWS_REGION || 'us-east-1',
  videoPrefix: 'hsl-daytradedak-videos/class-videos',
};

export const getCurrentCDNConfig = () => {
  return CDN_CONFIGS[CDN_PROVIDER];
};