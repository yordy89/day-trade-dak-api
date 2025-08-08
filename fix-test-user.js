const mongoose = require('mongoose');
require('dotenv').config();

async function fixTestUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection('users');
  
  // Update test user with correct subscription plan name
  const result = await User.updateOne(
    { email: 'test@test.com' },
    {
      $set: {
        subscription: {
          plan: 'MasterClases',  // Changed from MASTER_CLASES to MasterClases
          active: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          stripeCustomerId: 'test_customer',
          stripeSubscriptionId: 'test_subscription'
        },
        subscriptions: [{
          planId: 'MasterClases',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'active',
          createdAt: new Date()
        }],
        modulePermissions: {
          masterClasses: {
            access: true,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        }
      }
    }
  );
  
  console.log('Test user fixed:', result.modifiedCount > 0 ? 'Success' : 'No changes');
  
  // Verify the update
  const user = await User.findOne({ email: 'test@test.com' });
  console.log('Subscription plan:', user.subscription?.plan);
  console.log('Subscriptions:', user.subscriptions?.map(s => s.planId));
  console.log('Module permissions:', Object.keys(user.modulePermissions || {}));
  
  await mongoose.disconnect();
}

fixTestUser().catch(console.error);