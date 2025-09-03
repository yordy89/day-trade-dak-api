#!/usr/bin/env node

/**
 * Script to check for permission system issues
 * Run with: node scripts/check-permission-issues.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkPermissionIssues() {
  const client = new MongoClient(process.env.DATABASE_URL);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    const modulePermissionsCollection = db.collection('module_permissions');
    
    console.log('🔍 Checking Permission System Issues');
    console.log('=====================================\n');
    
    // Check for subscription date mismatches
    console.log('1. Checking for subscription date mismatches...');
    const usersWithSubs = await usersCollection.find({
      'subscriptions': { $exists: true, $ne: [] }
    }).toArray();
    
    let dateMismatchCount = 0;
    const dateMismatches = [];
    
    for (const user of usersWithSubs) {
      for (const sub of user.subscriptions) {
        if (typeof sub === 'object') {
          if (sub.currentPeriodEnd && sub.expiresAt) {
            const currentPeriodEnd = new Date(sub.currentPeriodEnd);
            const expiresAt = new Date(sub.expiresAt);
            
            if (currentPeriodEnd.getTime() !== expiresAt.getTime()) {
              dateMismatchCount++;
              dateMismatches.push({
                email: user.email,
                plan: sub.plan,
                currentPeriodEnd: sub.currentPeriodEnd,
                expiresAt: sub.expiresAt
              });
            }
          }
        }
      }
    }
    
    if (dateMismatchCount > 0) {
      console.log(`❌ Found ${dateMismatchCount} date mismatches`);
      console.log('   Run scripts/fix-subscription-dates.js to fix\n');
    } else {
      console.log('✅ No date mismatches found\n');
    }
    
    // Check for users with live meeting access
    console.log('2. Checking live meeting access...');
    const liveWeeklyUsers = await usersCollection.find({
      $or: [
        { 'subscriptions.plan': 'LiveWeeklyManual' },
        { 'subscriptions.plan': 'LiveWeeklyRecurring' },
        { 'subscriptions.plan': 'MasterClases' }
      ]
    }).toArray();
    
    console.log(`   Found ${liveWeeklyUsers.length} users with live meeting subscriptions`);
    
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;
    const expiredUsers = [];
    
    for (const user of liveWeeklyUsers) {
      let hasActive = false;
      
      for (const sub of user.subscriptions) {
        if (typeof sub === 'string') {
          if (['LiveWeeklyManual', 'LiveWeeklyRecurring', 'MasterClases'].includes(sub)) {
            hasActive = true;
            activeCount++;
          }
        } else {
          const plan = sub.plan;
          if (['LiveWeeklyManual', 'LiveWeeklyRecurring', 'MasterClases'].includes(plan)) {
            const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
            const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
            
            const notExpired = (!expiresAt || expiresAt > now) && 
                              (!currentPeriodEnd || currentPeriodEnd > now);
            
            if (notExpired) {
              hasActive = true;
              activeCount++;
            } else {
              expiredCount++;
              expiredUsers.push({
                email: user.email,
                plan: plan,
                expiresAt: sub.expiresAt,
                currentPeriodEnd: sub.currentPeriodEnd
              });
            }
          }
        }
      }
    }
    
    console.log(`   Active: ${activeCount}, Expired: ${expiredCount}\n`);
    
    // Check for module permissions
    console.log('3. Checking module permissions...');
    const modulePerms = await modulePermissionsCollection.find({
      isActive: true,
      hasAccess: true
    }).toArray();
    
    console.log(`   Found ${modulePerms.length} active module permissions`);
    
    const moduleTypeCount = {};
    for (const perm of modulePerms) {
      moduleTypeCount[perm.moduleType] = (moduleTypeCount[perm.moduleType] || 0) + 1;
    }
    
    console.log('   Module type distribution:');
    for (const [type, count] of Object.entries(moduleTypeCount)) {
      console.log(`     ${type}: ${count}`);
    }
    console.log('');
    
    // Check for inconsistent subscription plan names
    console.log('4. Checking for subscription plan name issues...');
    const allSubs = [];
    for (const user of usersWithSubs) {
      for (const sub of user.subscriptions) {
        const plan = typeof sub === 'string' ? sub : sub.plan;
        if (plan && !allSubs.includes(plan)) {
          allSubs.push(plan);
        }
      }
    }
    
    console.log('   Found subscription plans:');
    allSubs.sort().forEach(plan => {
      console.log(`     - ${plan}`);
    });
    
    // Check for potential issues
    const expectedPlans = [
      'LiveWeeklyManual',
      'LiveWeeklyRecurring',
      'MasterClases',
      'LiveRecorded',
      'Psicotrading',
      'Classes',
      'PeaceWithMoney',
      'MasterCourse',
      'CommunityEvent',
      'VipEvent',
      'Stocks'
    ];
    
    const unexpectedPlans = allSubs.filter(plan => !expectedPlans.includes(plan));
    if (unexpectedPlans.length > 0) {
      console.log('\n   ⚠️  Found unexpected plan names:');
      unexpectedPlans.forEach(plan => {
        console.log(`     - ${plan}`);
      });
    }
    
    // Summary
    console.log('\n=== Summary ===');
    if (dateMismatchCount === 0 && unexpectedPlans.length === 0) {
      console.log('✅ No critical issues found');
    } else {
      console.log('⚠️  Issues found that need attention:');
      if (dateMismatchCount > 0) {
        console.log(`   - ${dateMismatchCount} subscription date mismatches`);
      }
      if (unexpectedPlans.length > 0) {
        console.log(`   - ${unexpectedPlans.length} unexpected subscription plan names`);
      }
    }
    
    // Show sample of date mismatches
    if (dateMismatches.length > 0) {
      console.log('\n=== Sample Date Mismatches (first 5) ===');
      dateMismatches.slice(0, 5).forEach(mismatch => {
        console.log(`User: ${mismatch.email}`);
        console.log(`  Plan: ${mismatch.plan}`);
        console.log(`  currentPeriodEnd: ${mismatch.currentPeriodEnd}`);
        console.log(`  expiresAt: ${mismatch.expiresAt}`);
        console.log('');
      });
    }
    
    // Show expired users sample
    if (expiredUsers.length > 0) {
      console.log('\n=== Sample Expired Subscriptions (first 5) ===');
      expiredUsers.slice(0, 5).forEach(user => {
        console.log(`User: ${user.email}`);
        console.log(`  Plan: ${user.plan}`);
        console.log(`  Expired at: ${user.expiresAt || user.currentPeriodEnd}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error checking permissions:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

checkPermissionIssues().catch(console.error);