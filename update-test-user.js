const mongoose = require('mongoose');
require('dotenv').config();

async function updateTestUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection('users');
  
  // Update test user with proper module permissions
  const result = await User.updateOne(
    { email: 'test@test.com' },
    {
      $set: {
        modulePermissions: {
          masterClasses: {  // Changed from MASTER_CLASSES to masterClasses
            access: true,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        }
      }
    }
  );
  
  console.log('Test user updated:', result.modifiedCount > 0 ? 'Success' : 'No changes');
  
  // Verify the update
  const user = await User.findOne({ email: 'test@test.com' });
  console.log('Module permissions:', user.modulePermissions);
  
  await mongoose.disconnect();
}

updateTestUser().catch(console.error);