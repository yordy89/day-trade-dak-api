// Artillery processor for load testing

module.exports = {
  generateAuthToken: generateAuthToken,
  beforeRequest: beforeRequest,
  afterResponse: afterResponse,
};

// Store some test users for authenticated flows
const testUsers = [
  { email: 'loadtest1@example.com', password: 'Test123!@#' },
  { email: 'loadtest2@example.com', password: 'Test123!@#' },
  { email: 'loadtest3@example.com', password: 'Test123!@#' },
  { email: 'loadtest4@example.com', password: 'Test123!@#' },
  { email: 'loadtest5@example.com', password: 'Test123!@#' },
];

let tokenCache = {};
let requestCount = 0;
let errorCount = 0;

async function generateAuthToken(requestParams, context, ee, next) {
  // Pick a random test user
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  // Check if we have a cached token for this user
  if (tokenCache[user.email] && tokenCache[user.email].expiresAt > Date.now()) {
    context.vars.authToken = tokenCache[user.email].token;
    return next();
  }

  // Login to get a new token
  const axios = require('axios');
  try {
    const response = await axios.post(`${context.vars.target}/auth/login`, {
      email: user.email,
      password: user.password,
    });

    const token = response.data.access_token;
    
    // Cache the token for 50 minutes (assuming 1 hour expiry)
    tokenCache[user.email] = {
      token: token,
      expiresAt: Date.now() + (50 * 60 * 1000),
    };

    context.vars.authToken = token;
    next();
  } catch (error) {
    console.error('Failed to generate auth token:', error.message);
    next(new Error('Failed to authenticate'));
  }
}

function beforeRequest(requestParams, context, ee, next) {
  requestCount++;
  
  // Add correlation ID to all requests
  const correlationId = `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Correlation-Id'] = correlationId;
  
  // Log every 100th request
  if (requestCount % 100 === 0) {
    console.log(`Requests sent: ${requestCount}`);
  }
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Track errors
  if (response.statusCode >= 400) {
    errorCount++;
    console.error(`Error response: ${response.statusCode} for ${requestParams.url}`);
    
    // Log error details for debugging
    if (response.body) {
      console.error('Error body:', response.body);
    }
  }
  
  // Track slow responses
  if (response.timings && response.timings.phases && response.timings.phases.total > 1000) {
    console.warn(`Slow response: ${response.timings.phases.total}ms for ${requestParams.url}`);
  }
  
  // Emit custom metrics
  ee.emit('counter', 'http.requests.total', 1);
  
  if (response.statusCode >= 200 && response.statusCode < 300) {
    ee.emit('counter', 'http.requests.success', 1);
  } else if (response.statusCode >= 400 && response.statusCode < 500) {
    ee.emit('counter', 'http.requests.client_error', 1);
  } else if (response.statusCode >= 500) {
    ee.emit('counter', 'http.requests.server_error', 1);
  }
  
  // Log summary every 500 requests
  if (requestCount % 500 === 0) {
    console.log(`Summary - Total: ${requestCount}, Errors: ${errorCount}, Error Rate: ${(errorCount/requestCount*100).toFixed(2)}%`);
  }
  
  return next();
}