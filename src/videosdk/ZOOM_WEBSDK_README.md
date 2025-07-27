# Zoom Web SDK Integration

This module provides integration with Zoom Web SDK, allowing users to join Zoom meetings directly in the browser without needing to log into Zoom.

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Zoom Web SDK Credentials (different from API credentials)
ZOOM_SDK_KEY=your_sdk_key_here
ZOOM_SDK_SECRET=your_sdk_secret_here
```

**Important**: These are SDK App credentials, not API credentials. You need to create a SDK App in the Zoom App Marketplace.

### 2. Creating a Zoom SDK App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click on "Develop" → "Build App"
3. Choose "SDK" as the app type
4. Select "Meeting SDK"
5. Fill in the required information
6. Copy the SDK Key and SDK Secret

## API Endpoints

### 1. Check SDK Status

```http
GET /zoom-websdk/status
Authorization: Bearer {jwt_token}
```

Response:
```json
{
  "configured": true,
  "message": "Zoom Web SDK is properly configured"
}
```

### 2. Generate SDK Signature

```http
POST /zoom-websdk/signature
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "meetingNumber": "123 456 7890",
  "role": 0,
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "password": "optional_meeting_password"
}
```

Parameters:
- `meetingNumber` (required): The Zoom meeting number (9-11 digits)
- `role` (optional): 0 for participant, 1 for host (default: 0)
- `userName` (optional): Display name in the meeting (defaults to authenticated user's name)
- `userEmail` (optional): Email address (defaults to authenticated user's email)
- `password` (optional): Meeting password if required

Response:
```json
{
  "success": true,
  "credentials": {
    "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "sdkKey": "your_sdk_key",
    "meetingNumber": "1234567890",
    "role": 0,
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "password": "meeting_password"
  },
  "message": "SDK signature generated successfully"
}
```

### 3. Validate Meeting Access

```http
POST /zoom-websdk/validate-access
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "meetingNumber": "123 456 7890"
}
```

Response:
```json
{
  "hasAccess": true,
  "meetingNumber": "1234567890",
  "message": "User has access to this meeting"
}
```

## Frontend Integration

### 1. Install Zoom Meeting SDK

```bash
npm install @zoomus/websdk
```

### 2. Initialize and Join Meeting

```javascript
import ZoomMtgEmbedded from '@zoomus/websdk/embedded';

// Create client
const client = ZoomMtgEmbedded.createClient();

// Get SDK signature from backend
const response = await fetch('/zoom-websdk/signature', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    meetingNumber: '1234567890',
    role: 0
  })
});

const { credentials } = await response.json();

// Initialize SDK
const meetingSDKElement = document.getElementById('meetingSDKElement');
client.init({
  zoomAppRoot: meetingSDKElement,
  language: 'en-US',
  customize: {
    video: {
      isResizable: true,
      viewSizes: {
        default: {
          width: 1000,
          height: 600
        },
        ribbon: {
          width: 300,
          height: 700
        }
      }
    }
  }
});

// Join meeting
client.join({
  signature: credentials.signature,
  sdkKey: credentials.sdkKey,
  meetingNumber: credentials.meetingNumber,
  userName: credentials.userName,
  userEmail: credentials.userEmail,
  password: credentials.password || '',
  tk: '' // Optional registration token
});
```

## Security Considerations

1. **Authentication Required**: All endpoints require JWT authentication
2. **Signature Expiration**: SDK signatures expire after 4 hours
3. **Role Validation**: The backend should validate if a user can join as host
4. **Meeting Access**: Implement proper access control to verify users can join specific meetings

## Future Enhancements

The `validateMeetingAccess` method currently returns true for any valid meeting number. In production, you should implement logic to check if the user has access based on:

1. Event registrations
2. Subscription levels
3. Direct invitations
4. Meeting ownership

## Testing

Run the test suite:

```bash
npm test src/videosdk/zoom-websdk.service.spec.ts
```

## Troubleshooting

### Common Issues

1. **"SDK credentials are not configured"**
   - Ensure `ZOOM_SDK_KEY` and `ZOOM_SDK_SECRET` are set in your environment

2. **"Invalid meeting number format"**
   - Meeting numbers should be 9-11 digits
   - Spaces and hyphens are automatically removed

3. **Signature validation errors in frontend**
   - Ensure the SDK Key matches between backend and frontend
   - Check that the signature hasn't expired (4-hour limit)
   - Verify the meeting number format is consistent