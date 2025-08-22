const axios = require('axios');

async function testModuleAccess() {
  try {
    // First, login as the user
    const loginResponse = await axios.post('http://localhost:4000/api/v1/auth/login', {
      email: 'yordyat1107@gmail.com',
      password: 'test123' // You'll need to use the actual password
    });
    
    const token = loginResponse.data.access_token || loginResponse.data.token;
    console.log('Login successful, token received');
    
    // Now test the can-join endpoint
    // You'll need to replace this with an actual meeting ID
    const meetingId = '67991b3fa4b5c44dd956fedd'; // Replace with actual meeting ID
    
    const canJoinResponse = await axios.get(
      `http://localhost:4000/api/v1/meetings/${meetingId}/can-join`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    console.log('\nCan Join Response:', canJoinResponse.data);
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Note: You'll need to update the password and meeting ID
console.log('Please update the password and meeting ID in the script before running');
// testModuleAccess();