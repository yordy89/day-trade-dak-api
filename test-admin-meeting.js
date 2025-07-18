const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

async function testAdminMeetingFlow() {
  try {
    console.log('1. Testing login...');
    // First login as admin
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@daytradedak.com', // Update with actual admin email
      password: 'Admin@2024!' // Update with actual admin password
    });

    const { access_token, user } = loginResponse.data;
    console.log('Login successful:', { 
      userId: user._id,
      email: user.email,
      role: user.role,
      token: access_token.substring(0, 20) + '...'
    });

    // Set authorization header for subsequent requests
    const config = {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    };

    console.log('\n2. Testing GET /admin/meetings...');
    try {
      const meetingsResponse = await axios.get(`${API_URL}/admin/meetings`, config);
      console.log('GET meetings successful:', {
        total: meetingsResponse.data.total,
        page: meetingsResponse.data.page
      });
    } catch (error) {
      console.error('GET meetings failed:', error.response?.data || error.message);
    }

    console.log('\n3. Testing POST /admin/meetings...');
    try {
      const createMeetingData = {
        title: 'Test Meeting',
        description: 'Test meeting description',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        duration: 60,
        participants: [],
        isRecurring: false,
        maxParticipants: 100,
        isPublic: false,
        requiresApproval: false,
        enableRecording: false,
        enableChat: true,
        enableScreenShare: true,
        enableWaitingRoom: false,
        meetingType: 'other'
      };

      const createResponse = await axios.post(`${API_URL}/admin/meetings`, createMeetingData, config);
      console.log('POST meeting successful:', {
        id: createResponse.data._id,
        title: createResponse.data.title,
        status: createResponse.data.status
      });
    } catch (error) {
      console.error('POST meeting failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
    }

    console.log('\n4. Testing user profile to verify token...');
    try {
      const profileResponse = await axios.get(`${API_URL}/user/profile`, config);
      console.log('Profile check successful:', {
        userId: profileResponse.data._id,
        email: profileResponse.data.email,
        role: profileResponse.data.role
      });
    } catch (error) {
      console.error('Profile check failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testAdminMeetingFlow();