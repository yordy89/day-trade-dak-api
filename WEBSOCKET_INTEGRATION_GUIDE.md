# WebSocket Integration Guide for Live Meetings

## Overview
Instead of polling the `/api/v1/meetings/live-meetings` endpoint every 30 seconds, the frontend should connect to WebSocket and listen for real-time meeting updates.

## WebSocket Events

### 1. Meeting Started Event
When a Zoom meeting starts, the server emits:

```javascript
// Event: 'meeting-started'
{
  meetingId: "mongo_meeting_id",
  zoomMeetingId: "zoom_meeting_id",
  status: "live",
  startedAt: "2025-07-26T08:45:00Z",
  title: "Analysis de Trading en Vivo",
  host: {
    _id: "host_id",
    firstName: "John",
    lastName: "Doe",
    email: "host@example.com"
  }
}

// Event: 'live-meeting-update' (broadcast to all clients)
// Same data as above
```

### 2. Meeting Status Update
```javascript
// Event: 'meeting-status-update'
{
  meetingId: "mongo_meeting_id",
  status: "live" | "completed" | "cancelled",
  timestamp: "2025-07-26T08:45:00Z"
}
```

### 3. Meeting Ended Event
```javascript
// Event: 'meeting-ended'
{
  meetingId: "mongo_meeting_id",
  timestamp: "2025-07-26T09:45:00Z"
}
```

## Frontend Implementation Example

```javascript
import { io } from 'socket.io-client';

// Connect to WebSocket
const socket = io('http://localhost:4000', {
  auth: {
    token: localStorage.getItem('jwt_token') // Your JWT token
  }
});

// Listen for meeting updates
socket.on('live-meeting-update', (data) => {
  console.log('Live meeting started:', data);
  // Update UI to show "Join Now" button
  updateMeetingButton(data.meetingId, 'join-now');
});

socket.on('meeting-ended', (data) => {
  console.log('Meeting ended:', data);
  // Update UI to show "Meeting Ended"
  updateMeetingButton(data.meetingId, 'ended');
});

// Optional: Join specific meeting room for targeted updates
socket.emit('join-meeting', { meetingId: 'specific_meeting_id' });

socket.on('meeting-status-update', (data) => {
  console.log('Meeting status changed:', data);
  // Update meeting status in UI
  updateMeetingStatus(data.meetingId, data.status);
});
```

## Benefits

1. **Real-time Updates**: No delay - users see "Join Now" button immediately when meeting starts
2. **Reduced Server Load**: No polling every 30 seconds
3. **Better UX**: Instant feedback when meetings start/end
4. **Lower Bandwidth**: Only receive updates when something changes

## Implementation Steps

1. Remove polling logic from frontend
2. Connect to WebSocket on app initialization
3. Listen for the events listed above
4. Update UI based on WebSocket events
5. Keep one initial API call to get current meeting states on page load

## Error Handling

```javascript
socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
  // Fallback to polling if needed
});

socket.on('disconnect', () => {
  console.log('WebSocket disconnected');
  // Show connection lost indicator
});

socket.on('reconnect', () => {
  console.log('WebSocket reconnected');
  // Refresh meeting states
});
```

## Notes

- JWT token expiration is separate from WebSocket connection
- WebSocket will automatically emit events when Zoom webhooks are received
- No need to manually check meeting status anymore