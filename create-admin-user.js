const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createAdminUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection('users');
  
  // Delete existing admin if exists
  await User.deleteOne({ email: 'admin@test.com' });
  
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = {
    email: 'admin@test.com',
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',  // Super admin bypasses all checks
    stripeCustomerId: `admin_${Date.now()}`,  // Add unique stripe ID
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await User.insertOne(adminUser);
  console.log('Admin user created successfully:');
  console.log('Email: admin@test.com');
  console.log('Password: admin123');
  console.log('Role: super_admin');
  
  await mongoose.disconnect();
}

createAdminUser().catch(console.error);