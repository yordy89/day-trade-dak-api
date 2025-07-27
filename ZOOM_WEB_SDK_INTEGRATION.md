# Zoom Web SDK Integration Guide

## Why Zoom Asks for Login

When using standard Zoom URLs (`zoomJoinUrl` or `zoomStartUrl`), Zoom always requires authentication because:
1. These URLs redirect to Zoom's web client or desktop app
2. Zoom needs to verify the user's identity for security
3. The API credentials (Account ID, Client ID, Client Secret) are for server-to-server API calls, not for joining meetings

## Solution: Zoom Web SDK

The Zoom Web SDK allows users to join meetings directly in your web app without Zoom login.

## Setup Steps

### 1. Create a Zoom SDK App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click "Develop" → "Build App"
3. Choose "SDK" app type
4. Fill in the app details
5. Get your **SDK Key** and **SDK Secret** (different from API credentials)

### 2. Add SDK Credentials to .env

```env
# Existing Zoom API credentials (for creating/managing meetings)
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret

# New SDK credentials (for joining meetings in browser)
ZOOM_SDK_KEY=your_sdk_key
ZOOM_SDK_SECRET=your_sdk_secret
```

### 3. Backend Integration

The backend code is already set up with:
- `/zoom-websdk/signature` endpoint to generate SDK signatures
- Proper JWT token generation for Web SDK
- User access validation

### 4. Frontend Integration

Install Zoom Web SDK:
```bash
npm install @zoomus/websdk
```

Use the provided React component example or adapt it to your frontend framework.

### 5. Update Meeting Join Flow

Instead of redirecting to `zoomJoinUrl`:
```javascript
// Old way (requires Zoom login)
window.location.href = meeting.zoomJoinUrl;

// New way (no Zoom login required)
<ZoomMeeting 
  meetingId={meeting.zoomMeetingId}
  isHost={true}
  // ... other props
/>
```

## Benefits

1. **No Zoom Login Required**: Users join directly in your app
2. **Branded Experience**: Meeting runs inside your application
3. **Better Control**: You control the meeting UI and experience
4. **Seamless Integration**: No redirects or pop-ups

## Security Considerations

1. SDK signatures are time-limited (expire after a few hours)
2. Each signature is tied to a specific meeting and role
3. Your SDK Secret should never be exposed to the frontend
4. Always validate user permissions before generating signatures

## Limitations

- Web SDK has some feature limitations compared to native Zoom client
- Requires modern browsers with WebRTC support
- Some advanced features (like virtual backgrounds) may not be available

## Alternative: Zoom OAuth

If you prefer to keep using standard Zoom URLs but want a smoother login experience:
1. Implement Zoom OAuth in your app
2. Users authorize once and get refresh tokens
3. Auto-login users when they click meeting links

However, Web SDK provides the best integrated experience without requiring any Zoom account.