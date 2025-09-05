/**
 * Manual script to fix subscription currentPeriodEnd dates
 * Run this script to fix subscription dates for specific users or all affected users
 * 
 * Usage:
 * npm run script:fix-subscriptions -- --userId=689b88afb245f44694fd3629
 * npm run script:fix-subscriptions -- --all
 * npm run script:fix-subscriptions -- --email=abimaelsan25@hotmail.com
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Transaction } from '../payments/stripe/transaction.schema';
import { SubscriptionHistory } from '../payments/stripe/subscription-history.schema';
import { InjectModel } from '@nestjs/mongoose';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userModel = app.get<Model<User>>('UserModel');
  const transactionModel = app.get<Model<Transaction>>('TransactionModel');
  const subscriptionHistoryModel = app.get<Model<SubscriptionHistory>>('SubscriptionHistoryModel');
  const configService = app.get(ConfigService);
  
  const stripe = new Stripe(configService.get<string>('STRIPE_SECRET_KEY'), {
    apiVersion: '2025-01-27.acacia',
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  let userId: string | null = null;
  let email: string | null = null;
  let fixAll = false;

  args.forEach(arg => {
    if (arg.startsWith('--userId=')) {
      userId = arg.split('=')[1];
    } else if (arg.startsWith('--email=')) {
      email = arg.split('=')[1];
    } else if (arg === '--all') {
      fixAll = true;
    }
  });

  console.log('🔧 Subscription Date Fixer Script');
  console.log('================================');

  try {
    if (userId) {
      // Fix specific user by ID
      await fixUserById(userId, userModel, transactionModel, stripe);
    } else if (email) {
      // Fix specific user by email
      await fixUserByEmail(email, userModel, transactionModel, stripe);
    } else if (fixAll) {
      // Fix all users with active subscriptions
      await fixAllUsers(userModel, transactionModel, stripe);
    } else {
      // Default: Fix known problematic user
      console.log('🎯 Fixing known problematic user: abimaelsan25@hotmail.com');
      await fixUserByEmail('abimaelsan25@hotmail.com', userModel, transactionModel, stripe);
    }

    console.log('✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Error running script:', error);
  } finally {
    await app.close();
  }
}

async function fixUserById(
  userId: string,
  userModel: Model<User>,
  transactionModel: Model<Transaction>,
  stripe: Stripe
) {
  console.log(`\n🔍 Looking for user with ID: ${userId}`);
  
  const user = await userModel.findById(userId);
  if (!user) {
    console.error(`❌ User with ID ${userId} not found`);
    return;
  }

  await fixUserSubscriptions(user, userModel, transactionModel, stripe);
}

async function fixUserByEmail(
  email: string,
  userModel: Model<User>,
  transactionModel: Model<Transaction>,
  stripe: Stripe
) {
  console.log(`\n🔍 Looking for user with email: ${email}`);
  
  const user = await userModel.findOne({ email });
  if (!user) {
    console.error(`❌ User with email ${email} not found`);
    return;
  }

  await fixUserSubscriptions(user, userModel, transactionModel, stripe);
}

async function fixAllUsers(
  userModel: Model<User>,
  transactionModel: Model<Transaction>,
  stripe: Stripe
) {
  console.log(`\n🔍 Finding all users with active subscriptions...`);
  
  const users = await userModel.find({
    'subscriptions.stripeSubscriptionId': { $exists: true },
    activeSubscriptions: { $exists: true, $ne: [] }
  });

  console.log(`📊 Found ${users.length} users with active subscriptions`);

  for (const user of users) {
    await fixUserSubscriptions(user, userModel, transactionModel, stripe);
  }
}

async function fixUserSubscriptions(
  user: any,
  userModel: Model<User>,
  transactionModel: Model<Transaction>,
  stripe: Stripe
) {
  console.log(`\n👤 Processing user: ${user.email} (${user._id})`);
  console.log(`📋 Current subscriptions:`);
  
  user.subscriptions.forEach((sub: any) => {
    console.log(`  - Plan: ${sub.plan}`);
    console.log(`    Stripe ID: ${sub.stripeSubscriptionId}`);
    console.log(`    Current Period End: ${sub.currentPeriodEnd}`);
    console.log(`    Expires At: ${sub.expiresAt}`);
    console.log(`    Status: ${sub.status}`);
  });

  // Method 1: Check recent transactions
  console.log(`\n📦 Checking recent transactions...`);
  
  const recentTransactions = await transactionModel.find({
    userId: user._id,
    type: 'subscription_payment',
    status: 'succeeded',
    subscriptionId: { $exists: true },
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  }).sort({ createdAt: -1 });

  console.log(`  Found ${recentTransactions.length} recent subscription payments`);

  // Method 2: Check Stripe API
  if (user.stripeCustomerId) {
    console.log(`\n🔄 Fetching data from Stripe...`);
    
    try {
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active'
      });

      console.log(`  Found ${stripeSubscriptions.data.length} active Stripe subscriptions`);

      // Update each subscription
      for (const stripeSub of stripeSubscriptions.data) {
        const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);
        const plan = stripeSub.metadata?.plan || 'Unknown';
        
        console.log(`\n  📅 Stripe Subscription: ${stripeSub.id}`);
        console.log(`     Plan: ${plan}`);
        console.log(`     Status: ${stripeSub.status}`);
        console.log(`     Current Period End: ${newPeriodEnd.toISOString()}`);

        // Find matching user subscription
        const userSubIndex = user.subscriptions.findIndex(
          (s: any) => s.stripeSubscriptionId === stripeSub.id
        );

        if (userSubIndex >= 0) {
          const currentSub = user.subscriptions[userSubIndex];
          
          if (!currentSub.currentPeriodEnd || 
              currentSub.currentPeriodEnd.getTime() !== newPeriodEnd.getTime()) {
            
            console.log(`\n  ⚠️ Subscription needs update!`);
            console.log(`     Old date: ${currentSub.currentPeriodEnd}`);
            console.log(`     New date: ${newPeriodEnd.toISOString()}`);

            // Perform the update using positional operator
            const updateResult = await userModel.updateOne(
              { 
                _id: user._id,
                'subscriptions.stripeSubscriptionId': stripeSub.id
              },
              {
                $set: {
                  'subscriptions.$.currentPeriodEnd': newPeriodEnd,
                  'subscriptions.$.expiresAt': newPeriodEnd,
                  'subscriptions.$.status': stripeSub.status,
                  'subscriptions.$.plan': plan,
                  updatedAt: new Date()
                }
              }
            );

            if (updateResult.modifiedCount > 0) {
              console.log(`  ✅ Successfully updated subscription`);
            } else {
              console.log(`  ⚠️ Update didn't modify - trying alternative method`);
              
              // Alternative: Replace entire array
              const updatedSubs = user.subscriptions.map((s: any, idx: number) => {
                if (idx === userSubIndex) {
                  return {
                    plan: s.plan || plan,
                    stripeSubscriptionId: s.stripeSubscriptionId,
                    currentPeriodEnd: newPeriodEnd,
                    expiresAt: newPeriodEnd,
                    status: stripeSub.status,
                    createdAt: s.createdAt || new Date()
                  };
                }
                return {
                  plan: s.plan,
                  stripeSubscriptionId: s.stripeSubscriptionId,
                  currentPeriodEnd: s.currentPeriodEnd,
                  expiresAt: s.expiresAt,
                  status: s.status,
                  createdAt: s.createdAt
                };
              });

              const replaceResult = await userModel.updateOne(
                { _id: user._id },
                { 
                  $set: { 
                    subscriptions: updatedSubs,
                    updatedAt: new Date()
                  }
                }
              );

              if (replaceResult.modifiedCount > 0) {
                console.log(`  ✅ Successfully updated using array replacement`);
              } else {
                console.log(`  ❌ Failed to update subscription`);
              }
            }
          } else {
            console.log(`  ✅ Subscription already up to date`);
          }
        } else {
          console.log(`  ⚠️ Stripe subscription ${stripeSub.id} not found in user document`);
          
          // Add the missing subscription
          const addResult = await userModel.updateOne(
            { _id: user._id },
            {
              $push: {
                subscriptions: {
                  plan: plan,
                  stripeSubscriptionId: stripeSub.id,
                  currentPeriodEnd: newPeriodEnd,
                  expiresAt: newPeriodEnd,
                  status: stripeSub.status,
                  createdAt: new Date(stripeSub.created * 1000)
                }
              },
              $addToSet: {
                activeSubscriptions: stripeSub.id
              }
            }
          );

          if (addResult.modifiedCount > 0) {
            console.log(`  ✅ Added missing subscription`);
          }
        }
      }

    } catch (error) {
      console.error(`  ❌ Error fetching Stripe data:`, error);
    }
  }

  // Verify the changes
  console.log(`\n🔍 Verifying changes...`);
  const updatedUser = await userModel.findById(user._id);
  
  if (updatedUser) {
    console.log(`\n📋 Updated subscriptions:`);
    updatedUser.subscriptions.forEach((sub: any) => {
      console.log(`  - Plan: ${sub.plan}`);
      console.log(`    Stripe ID: ${sub.stripeSubscriptionId}`);
      console.log(`    Current Period End: ${sub.currentPeriodEnd}`);
      console.log(`    Status: ${sub.status}`);
    });
  }
}

// Run the script
bootstrap().catch(console.error);