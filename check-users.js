const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection('users');
  const users = await User.find({}).limit(5).toArray();
  console.log('Sample users in database:');
  users.forEach(u => {
    console.log(`  - ${u.email} (role: ${u.role}, plan: ${u.subscription?.plan || 'none'})`);
  });
  
  // Check for yordy user
  const yordyUser = await User.findOne({ email: 'yordy@gmail.com' });
  if (yordyUser) {
    console.log('\nFound yordy@gmail.com user:');
    console.log(`  - ID: ${yordyUser._id}`);
    console.log(`  - Role: ${yordyUser.role}`);
    console.log(`  - Subscription plan: ${yordyUser.subscription?.plan || 'none'}`);
    console.log(`  - Active: ${yordyUser.subscription?.active || false}`);
  } else {
    console.log('\nyordy@gmail.com user not found');
  }
  
  await mongoose.disconnect();
}

checkUsers().catch(console.error);