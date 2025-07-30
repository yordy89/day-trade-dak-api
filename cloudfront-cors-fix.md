# CloudFront CORS Configuration for HLS Video Streaming

## Problem
The HLS video player is encountering CORS errors when trying to load video content from CloudFront:
- Origin: `http://localhost:3000`
- CloudFront Domain: `https://d3m2tao2a2xtek.cloudfront.net`
- Error: "No 'Access-Control-Allow-Origin' header is present on the requested resource"

## Solution: Configure CloudFront Distribution

### Option 1: Using Response Headers Policy (Recommended)

1. Go to AWS CloudFront Console
2. Select your distribution (`d3m2tao2a2xtek.cloudfront.net`)
3. Go to the "Behaviors" tab
4. Edit the default behavior or create a new one for path pattern `hsl-daytradedak-videos/*`
5. Under "Response headers policy", create a new policy or select an existing one
6. Configure the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Max-Age: 86400
```

For production, replace `*` with specific origins:
```
Access-Control-Allow-Origin: https://yourdomain.com
```

### Option 2: Using Lambda@Edge

Create a Lambda@Edge function to add CORS headers:

```javascript
exports.handler = async (event) => {
    const response = event.Records[0].cf.response;
    
    // Add CORS headers
    response.headers['access-control-allow-origin'] = [{
        key: 'Access-Control-Allow-Origin',
        value: '*' // Replace with specific origin in production
    }];
    
    response.headers['access-control-allow-methods'] = [{
        key: 'Access-Control-Allow-Methods',
        value: 'GET, HEAD, OPTIONS'
    }];
    
    response.headers['access-control-allow-headers'] = [{
        key: 'Access-Control-Allow-Headers',
        value: '*'
    }];
    
    response.headers['access-control-max-age'] = [{
        key: 'Access-Control-Max-Age',
        value: '86400'
    }];
    
    return response;
};
```

## Temporary Development Workaround

While waiting for CloudFront configuration, you can:

1. Use a proxy in your Next.js application
2. Temporarily use S3 signed URLs instead of CloudFront
3. Use a browser extension to disable CORS (development only)

## Testing

After applying the CloudFront changes:
1. Wait for distribution deployment (can take 15-30 minutes)
2. Clear browser cache
3. Test video playback

## Important Notes

- HLS streaming requires CORS headers on all resources: .m3u8 playlists and .ts segments
- The `overrideNative: true` setting in video.js is correct for cross-origin HLS
- Consider setting up multiple behaviors in CloudFront for different content types