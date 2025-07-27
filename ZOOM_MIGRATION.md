# Zoom Migration Guide

## Overview
This guide documents the migration from VideoSDK to Zoom for the DayTradeDak meeting feature.

## Configuration

### Environment Variables
Add the following to your `.env` file:

```bash
# Enable Zoom integration (set to true to use Zoom instead of VideoSDK)
USE_ZOOM_MEETINGS=true

# Zoom Personal Meeting ID (PMI)
ZOOM_PERSONAL_MEETING_ID=123-456-7890

# Zoom Meeting Password (optional but recommended)
ZOOM_MEETING_PASSWORD=yourpassword

# Optional: Zoom domain (defaults to zoom.us)
ZOOM_DOMAIN=zoom.us
```

### How to Get Your Zoom Credentials

1. **Personal Meeting ID (PMI)**:
   - Log in to your Zoom account
   - Go to Settings > Personal > Personal Meeting ID
   - Copy your 10 or 11 digit PMI

2. **Meeting Password**:
   - In the same settings page, set a password for your PMI
   - This ensures only authorized users can join

## Migration Steps

### Phase 1: Feature Flags (COMPLETED)
- Added feature flags to hide meeting features in CRM and Admin
- Files modified:
  - `/src/config/features.ts` (CRM & Admin)
  - Navigation and sidebar components

### Phase 2: Zoom Service (COMPLETED)
- Created Zoom service to generate meeting URLs
- Updated meetings service to support both VideoSDK and Zoom
- Files created/modified:
  - `/src/videosdk/zoom.service.ts`
  - `/src/meetings/meetings.service.ts`
  - `/src/config/features.config.ts`

### Phase 3: Frontend Updates (PENDING)
- Update frontend to handle Zoom URLs
- Redirect users to Zoom web client
- Remove VideoSDK UI components when using Zoom

### Phase 4: Testing
1. Set `USE_ZOOM_MEETINGS=true` in `.env`
2. Add your Zoom credentials
3. Test meeting join flow
4. Verify host vs participant experience

## API Response Changes

When using Zoom, the `/meetings/:id/token` endpoint returns:

```json
{
  "token": "",
  "roomId": "meeting-id",
  "role": "host|participant",
  "zoomUrl": "https://zoom.us/wc/join/...",
  "useZoom": true
}
```

## Frontend Handling

The frontend should check the `useZoom` flag:
- If `true`: Open `zoomUrl` in a new tab/window
- If `false`: Use existing VideoSDK integration

## Rollback Plan

To rollback to VideoSDK:
1. Set `USE_ZOOM_MEETINGS=false` in `.env`
2. Ensure VideoSDK credentials are still configured
3. Restart the API server