// Script to fix subscription dates by fetching current data from Stripe
// Usage: node fix-subscription-dates.js [userId or email]

const mongoose = require('mongoose');
const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daytraddak';

// User schema (simplified)
const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  stripeCustomerId: String,
  subscriptions: [{
    plan: String,
    stripeSubscriptionId: String,
    currentPeriodEnd: Date,
    expiresAt: Date,
    status: String,
    createdAt: Date
  }],
  activeSubscriptions: [String]
});

const User = mongoose.model('User', userSchema);

async function fixSubscriptionDates(userIdentifier) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user
    let user;
    if (userIdentifier) {
      // Try to find by ID or email
      user = await User.findOne({
        $or: [
          { _id: userIdentifier },
          { email: userIdentifier },
          { stripeCustomerId: userIdentifier }
        ]
      });
    } else {
      // Fix all users with LiveWeeklyRecurring subscriptions
      const users = await User.find({
        'subscriptions.plan': { $in: ['LiveWeeklyRecurring', 'LiveWeeklyManual'] }
      });
      
      console.log(`Found ${users.length} users with Live Weekly subscriptions`);
      
      for (const u of users) {
        await fixUserSubscriptions(u);
      }
      
      console.log('✅ All users processed');
      process.exit(0);
    }

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    await fixUserSubscriptions(user);
    console.log('✅ Complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function fixUserSubscriptions(user) {
  console.log(`\n👤 Processing user: ${user.email}`);
  
  if (!user.stripeCustomerId) {
    console.log('⚠️  No Stripe customer ID, skipping');
    return;
  }

  // Get all subscriptions from Stripe
  const stripeSubscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: 'active',
    limit: 100
  });

  let hasUpdates = false;
  const updatedSubscriptions = user.subscriptions.map(sub => {
    // Find matching Stripe subscription
    const stripeSub = stripeSubscriptions.data.find(
      s => s.id === sub.stripeSubscriptionId
    );

    if (stripeSub) {
      const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);
      const oldPeriodEnd = sub.currentPeriodEnd;
      
      if (!oldPeriodEnd || oldPeriodEnd.getTime() !== newPeriodEnd.getTime()) {
        console.log(`  📅 Updating ${sub.plan}:`);
        console.log(`     Old period end: ${oldPeriodEnd || 'not set'}`);
        console.log(`     New period end: ${newPeriodEnd}`);
        console.log(`     Status: ${stripeSub.status}`);
        
        hasUpdates = true;
        
        return {
          ...sub.toObject(),
          currentPeriodEnd: newPeriodEnd,
          expiresAt: newPeriodEnd,
          status: stripeSub.status
        };
      }
    } else if (sub.stripeSubscriptionId) {
      console.log(`  ⚠️  No active Stripe subscription found for ${sub.stripeSubscriptionId}`);
      
      // Check if it's canceled
      try {
        const canceledSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (canceledSub.status !== 'active') {
          console.log(`     Status in Stripe: ${canceledSub.status}`);
          
          hasUpdates = true;
          return {
            ...sub.toObject(),
            status: canceledSub.status,
            currentPeriodEnd: new Date(canceledSub.current_period_end * 1000)
          };
        }
      } catch (e) {
        console.log(`     Subscription not found in Stripe`);
      }
    }
    
    return sub;
  });

  // Also check for Stripe subscriptions not in database
  for (const stripeSub of stripeSubscriptions.data) {
    const exists = user.subscriptions.some(
      s => s.stripeSubscriptionId === stripeSub.id
    );
    
    if (!exists && stripeSub.metadata?.plan) {
      console.log(`  ➕ Adding missing subscription: ${stripeSub.metadata.plan}`);
      hasUpdates = true;
      
      updatedSubscriptions.push({
        plan: stripeSub.metadata.plan,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        expiresAt: new Date(stripeSub.current_period_end * 1000),
        status: stripeSub.status,
        createdAt: new Date(stripeSub.created * 1000)
      });
    }
  }

  if (hasUpdates) {
    user.subscriptions = updatedSubscriptions;
    await user.save();
    console.log('  ✅ User updated');
  } else {
    console.log('  ✔️  User already up to date');
  }
}

// Run the script
const userIdentifier = process.argv[2];

if (process.argv.includes('--help')) {
  console.log(`
Usage: node fix-subscription-dates.js [userId|email|stripeCustomerId]

Examples:
  node fix-subscription-dates.js                    # Fix all Live Weekly subscriptions
  node fix-subscription-dates.js user@example.com   # Fix specific user
  node fix-subscription-dates.js cus_xxxxxx         # Fix by Stripe customer ID
  `);
  process.exit(0);
}

fixSubscriptionDates(userIdentifier);