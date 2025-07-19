# Brevo Lists Configuration

## Environment Variables

Add these to your `.env` file to enable automatic addition of event registrants to Brevo marketing lists:

```env
# General event registrants list ID (get from Brevo dashboard)
BREVO_EVENT_LIST_ID=123

# Specific event type lists (optional)
BREVO_COMMUNITY_EVENT_LIST_ID=124
BREVO_MASTER_COURSE_LIST_ID=125
BREVO_VIP_EVENT_LIST_ID=126
```

## How to Get List IDs from Brevo

1. Log into your Brevo account
2. Go to Contacts > Lists
3. Create lists for:
   - "Event Registrants - All" (general list)
   - "Community Event Registrants" (optional)
   - "Master Course Registrants" (optional)
   - "VIP Event Registrants" (optional)
4. Click on each list to view details
5. The List ID will be shown in the URL or list details

## Features

When someone registers for an event:
1. They receive a confirmation email
2. They are automatically added to the appropriate Brevo list(s)
3. The following attributes are stored:
   - FIRSTNAME
   - LASTNAME (if provided)
   - SMS (phone number if provided)
   - EVENT_TYPE
   - REGISTRATION_DATE

## Marketing Benefits

- Send targeted campaigns to event attendees
- Create segments based on event type
- Track engagement from different event types
- Build automated email sequences for post-event follow-up
- Send event reminders and updates

## Error Handling

- If Brevo lists are not configured, the system logs a warning but doesn't break registration
- If a contact already exists, it updates their information
- Failures to add to lists don't affect the registration process