# CDN Setup Guide for Protected S3 Videos

## How It Works

Since your S3 bucket is protected, all video URLs must be signed/authenticated. The signing happens in the API, not the frontend.

### Architecture:
```
Protected S3 Bucket
    ↓
CloudFront/BunnyCDN (Pull from S3)
    ↓
API (Generates signed URLs)
    ↓
CRM Frontend (Plays videos)
```

## Current Setup (CloudFront)

1. **S3 Bucket**: `day-trade-dak-resources` (private)
2. **CloudFront Distribution**: Points to S3 bucket
3. **API**: Generates CloudFront signed URLs
4. **CRM**: Receives and plays signed URLs

## Setting Up BunnyCDN

### Step 1: Create BunnyCDN Pull Zone

1. Sign up at https://bunnycdn.com
2. Create a new Pull Zone:
   ```
   Name: daytradedak-videos
   Origin URL: https://s3.amazonaws.com/day-trade-dak-resources
   ```

3. Configure Pull Zone:
   - Enable "Token Authentication" in Security settings
   - Copy the "Authentication Key"
   - Note your Pull Zone URL (e.g., `daytradedak.b-cdn.net`)

### Step 2: Configure S3 Bucket Policy for BunnyCDN

Add BunnyCDN IPs to your S3 bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBunnyCDN",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::day-trade-dak-resources/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": [
            // BunnyCDN IP ranges (get latest from their docs)
            "143.244.0.0/16",
            "5.182.16.0/21",
            // ... more IPs
          ]
        }
      }
    }
  ]
}
```

### Step 3: Update API Environment Variables

```bash
# In DayTradeDakApi/.env
CDN_PROVIDER=bunnycdn
BUNNYCDN_DOMAIN=daytradedak.b-cdn.net
BUNNYCDN_AUTHENTICATION_KEY=your-auth-key-here
```

### Step 4: No Frontend Changes Needed!

The CRM will automatically receive BunnyCDN URLs from the API.

## How CDN Switching Works

### API Side (Where the magic happens):

```typescript
// The CDN service automatically uses the configured provider
const signedUrl = await this.cdnService.generateVideoUrl('clase_1/master.m3u8');

// CloudFront: Returns CloudFront signed URL
// BunnyCDN: Returns BunnyCDN token-authenticated URL
// S3: Returns S3 presigned URL
```

### Frontend Side (No changes needed):

```typescript
// Frontend just plays whatever URL the API provides
const response = await api.get('/academy/video/123/url');
player.src(response.data.url); // Works with any CDN
```

## Testing the Switch

1. **Before switching**, test current setup:
   ```bash
   curl http://localhost:4000/academy/video/test-video/url
   # Should return CloudFront URL
   ```

2. **Switch to BunnyCDN**:
   ```bash
   # Update .env
   CDN_PROVIDER=bunnycdn
   
   # Restart API
   npm run start:dev
   ```

3. **Test new setup**:
   ```bash
   curl http://localhost:4000/academy/video/test-video/url
   # Should now return BunnyCDN URL
   ```

## Cost Comparison

### CloudFront (Current)
- Data Transfer: $0.085/GB
- Requests: $0.0075/10K
- No minimum commitment

### BunnyCDN
- Data Transfer: $0.005-$0.045/GB (95% cheaper!)
- Requests: Free
- $1 minimum monthly charge

### Example Monthly Costs (1TB transfer)
- CloudFront: $85
- BunnyCDN: $5-45 (depending on region)

## Rollback Plan

If BunnyCDN doesn't work:

```bash
# In API .env
CDN_PROVIDER=cloudfront

# Restart API
npm run start:dev
```

Videos immediately switch back to CloudFront.

## Security Considerations

1. **Token Expiry**: Both CDNs support URL expiry (default: 1 hour)
2. **IP Restrictions**: Can be added if needed
3. **CORS**: Already handled by both CDNs
4. **SSL**: Both provide free SSL

## Monitoring

After switching, monitor:
1. API logs for CDN provider being used
2. Video playback in CRM
3. BunnyCDN analytics dashboard
4. AWS billing (should decrease)