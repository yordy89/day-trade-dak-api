const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createTestUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection('users');
  
  // Check if test user exists
  const existing = await User.findOne({ email: 'test@test.com' });
  if (existing) {
    console.log('Test user already exists');
    await mongoose.disconnect();
    return;
  }
  
  // Create test user with subscription
  const hashedPassword = await bcrypt.hash('test123', 10);
  
  const testUser = {
    email: 'test@test.com',
    password: hashedPassword,
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    subscription: {
      plan: 'MASTER_CLASES',
      active: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      stripeCustomerId: 'test_customer',
      stripeSubscriptionId: 'test_subscription'
    },
    modulePermissions: {
      MASTER_CLASSES: {
        access: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    },
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await User.insertOne(testUser);
  console.log('Test user created successfully:');
  console.log('Email: test@test.com');
  console.log('Password: test123');
  console.log('Subscription: MASTER_CLASES (active)');
  
  await mongoose.disconnect();
}

createTestUser().catch(console.error);