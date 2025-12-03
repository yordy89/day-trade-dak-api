/**
 * Fix Duplicate Subscriptions Script
 *
 * This script finds and fixes duplicate subscriptions in the database.
 * For each user with duplicate subscriptions for the same plan:
 * 1. Identifies all subscriptions for each plan
 * 2. Keeps the most recent one (by createdAt)
 * 3. Cancels extra subscriptions in Stripe
 * 4. Removes duplicates from the user document
 *
 * Usage:
 *   npx ts-node scripts/fix-duplicate-subscriptions.ts [--dry-run]
 *
 * Options:
 *   --dry-run   Show what would be done without making changes
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { User } from '../src/users/user.schema';
import Stripe from 'stripe';
import { getModelToken } from '@nestjs/mongoose';

interface SubscriptionInfo {
  plan: string;
  stripeSubscriptionId?: string;
  expiresAt?: Date;
  currentPeriodEnd?: Date;
  status?: string;
  createdAt?: Date;
}

async function fixDuplicateSubscriptions() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Fix Duplicate Subscriptions Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('ERROR: STRIPE_SECRET_KEY environment variable not set');
    await app.close();
    return;
  }

  const stripe = new Stripe(stripeSecretKey);

  console.log('Starting duplicate subscription cleanup...\n');

  // Find users with more than one subscription (potential duplicates)
  const users = await userModel.find({
    'subscriptions.1': { $exists: true }
  });

  console.log(`Found ${users.length} users with multiple subscriptions\n`);

  let usersWithDuplicates = 0;
  let totalDuplicatesFixed = 0;
  let stripeSubscriptionsCancelled = 0;

  for (const user of users) {
    const subscriptionsByPlan = new Map<string, SubscriptionInfo[]>();

    // Group subscriptions by plan
    for (const sub of user.subscriptions) {
      const existing = subscriptionsByPlan.get(sub.plan) || [];
      existing.push(sub as SubscriptionInfo);
      subscriptionsByPlan.set(sub.plan, existing);
    }

    // Check for duplicates
    let userHasDuplicates = false;

    for (const [plan, subs] of subscriptionsByPlan) {
      if (subs.length > 1) {
        userHasDuplicates = true;
        usersWithDuplicates++;

        console.log('-'.repeat(50));
        console.log(`User: ${user.email} (${user._id})`);
        console.log(`Plan: ${plan}`);
        console.log(`Found ${subs.length} subscriptions (DUPLICATE!)`);

        // Sort by createdAt descending (newest first)
        const sorted = subs.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        const toKeep = sorted[0];
        const toRemove = sorted.slice(1);

        console.log(`\n  KEEPING: ${toKeep.stripeSubscriptionId || 'local'}`);
        console.log(`    - Created: ${toKeep.createdAt || 'unknown'}`);
        console.log(`    - Expires: ${toKeep.expiresAt || toKeep.currentPeriodEnd || 'never'}`);
        console.log(`    - Status: ${toKeep.status || 'unknown'}`);

        console.log(`\n  REMOVING ${toRemove.length} duplicate(s):`);

        for (const sub of toRemove) {
          console.log(`    - ${sub.stripeSubscriptionId || 'local'}`);
          console.log(`      Created: ${sub.createdAt || 'unknown'}`);
          console.log(`      Status: ${sub.status || 'unknown'}`);

          // Cancel in Stripe if has subscription ID
          if (sub.stripeSubscriptionId && !isDryRun) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

              if (stripeSub.status !== 'canceled') {
                await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
                console.log(`      -> Cancelled in Stripe`);
                stripeSubscriptionsCancelled++;
              } else {
                console.log(`      -> Already cancelled in Stripe`);
              }
            } catch (e: any) {
              if (e.code === 'resource_missing') {
                console.log(`      -> Not found in Stripe (already deleted)`);
              } else {
                console.log(`      -> Error cancelling: ${e.message}`);
              }
            }
          }

          totalDuplicatesFixed++;
        }

        // Update user - keep only the newest subscription for this plan
        if (!isDryRun) {
          const uniqueSubscriptions = user.subscriptions.filter(
            (s: SubscriptionInfo) => s.plan !== plan ||
              (s.stripeSubscriptionId === toKeep.stripeSubscriptionId &&
               (!s.createdAt || !toKeep.createdAt ||
                new Date(s.createdAt).getTime() === new Date(toKeep.createdAt).getTime()))
          );

          // Also clean up activeSubscriptions array
          const stripeIdsToRemove = toRemove
            .map(s => s.stripeSubscriptionId)
            .filter(Boolean) as string[];

          await userModel.updateOne(
            { _id: user._id },
            {
              $set: { subscriptions: uniqueSubscriptions },
              $pull: { activeSubscriptions: { $in: stripeIdsToRemove } }
            }
          );

          console.log(`\n  -> Database updated`);
        } else {
          console.log(`\n  -> [DRY RUN] Would update database`);
        }

        break; // Only count user once
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Users with duplicates: ${usersWithDuplicates}`);
  console.log(`Total duplicate subscriptions fixed: ${totalDuplicatesFixed}`);
  console.log(`Stripe subscriptions cancelled: ${stripeSubscriptionsCancelled}`);

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes were made. Run without --dry-run to apply fixes.');
  }

  await app.close();
}

fixDuplicateSubscriptions().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
