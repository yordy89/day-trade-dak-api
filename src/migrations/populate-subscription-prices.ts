import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

// Development Stripe Price IDs (from the existing code)
const DEV_PRICE_MAPPINGS = {
  // Community Subscriptions
  LiveWeeklyManual: {
    stripeProductId: 'prod_RNkRQtYPxxWKDI',
    stripePriceId: 'price_1Rj37aJ1acFkbhNI6psETNkH',
  },
  LiveWeeklyRecurring: {
    stripeProductId: 'prod_RNkWMGrKS5JZXN',
    stripePriceId: 'price_1Rj383J1acFkbhNIO3TfFmnl',
  },

  // Recurring Monthly Subscriptions
  MasterClases: {
    stripeProductId: 'prod_RNoYe5hhXJhxDx',
    stripePriceId: 'price_1Rk7OOJ1acFkbhNI1JAr62Lw',
  },
  LiveRecorded: {
    stripeProductId: 'prod_RNoaJkoyEOlXl0',
    stripePriceId: 'price_1Rk7PoJ1acFkbhNInNuVejrp',
  },
  Psicotrading: {
    stripeProductId: 'prod_RNIQ6SJmLiP9Sd',
    stripePriceId: 'price_1RNIS6J1acFkbhNIyPeQVOAS',
  },

  // One-Time Purchases
  Classes: {
    stripeProductId: 'prod_RNnfMCjRsqJaAX',
    stripePriceId: 'price_1Rk6VVJ1acFkbhNIGFGK4mzA',
  },
  PeaceWithMoney: {
    stripeProductId: 'prod_RX2i27dCeYMoOU',
    stripePriceId: 'price_1RX2hDJ1acFkbhNIq4mDa1Js',
  },
  MasterCourse: {
    stripeProductId: 'prod_RNkXGC0jmnZSJC',
    stripePriceId: 'price_1Rj38bJ1acFkbhNID7qBD4lz',
  },
  CommunityEvent: {
    stripeProductId: 'prod_RNoPOgnLm1DK5r',
    stripePriceId: 'price_1RjVpqJ1acFkbhNIGH06m1RA',
  },
  VipEvent: {
    stripeProductId: 'prod_RJKvnQ7LQ7GXYM',
    stripePriceId: 'price_1RJKtNJ1acFkbhNIBNsLFT4p',
  },
};

// Production Stripe Price IDs (to be added when available)
const PROD_PRICE_MAPPINGS = {
  // These will be populated with production Stripe IDs when available
  // For now, using the same as dev for the structure
  LiveWeeklyManual: {
    stripeProductId: 'prod_XXXX', // TODO: Add production ID
    stripePriceId: 'price_XXXX', // TODO: Add production ID
  },
  LiveWeeklyRecurring: {
    stripeProductId: 'prod_XXXX', // TODO: Add production ID
    stripePriceId: 'price_XXXX', // TODO: Add production ID
  },
  // ... etc
};

async function populateSubscriptionPrices() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const subscriptionPlansCollection = db.collection('subscription_plans');

    // Determine which price mappings to use based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const priceMappings = isProduction ? PROD_PRICE_MAPPINGS : DEV_PRICE_MAPPINGS;

    console.log(`Using ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} Stripe price IDs`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const [planId, stripeIds] of Object.entries(priceMappings)) {
      try {
        const result = await subscriptionPlansCollection.updateOne(
          { planId },
          {
            $set: {
              stripeProductId: stripeIds.stripeProductId,
              stripePriceId: stripeIds.stripePriceId,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount > 0) {
          console.log(`✅ Updated ${planId} with Stripe IDs`);
          updatedCount++;
        } else {
          console.log(`⚠️  No plan found with planId: ${planId}`);
        }
      } catch (error) {
        console.error(`❌ Error updating plan ${planId}:`, error);
        errorCount++;
      }
    }

    // Also update the pricing amounts based on the current hardcoded values
    const pricingUpdates = [
      { planId: 'LiveWeeklyManual', amount: 5399 }, // $53.99
      { planId: 'LiveWeeklyRecurring', amount: 5399 }, // $53.99
      { planId: 'MasterClases', amount: 19999 }, // $199.99
      { planId: 'LiveRecorded', amount: 5299 }, // $52.99
      { planId: 'Psicotrading', amount: 2999 }, // $29.99
      { planId: 'Classes', amount: 50000 }, // $500.00
      { planId: 'PeaceWithMoney', amount: 19999 }, // $199.99
      { planId: 'MasterCourse', amount: 299999 }, // $2999.99
      { planId: 'CommunityEvent', amount: 59999 }, // $599.99
      { planId: 'VipEvent', amount: 9999 }, // $99.99
    ];

    console.log('\nUpdating subscription plan amounts...');
    for (const { planId, amount } of pricingUpdates) {
      try {
        const result = await subscriptionPlansCollection.updateOne(
          { planId },
          {
            $set: {
              amount,
              currency: 'usd',
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount > 0) {
          console.log(`✅ Updated ${planId} amount to $${amount / 100}`);
        }
      } catch (error) {
        console.error(`❌ Error updating amount for ${planId}:`, error);
      }
    }

    // Add conditional pricing metadata
    console.log('\nAdding conditional pricing metadata...');
    
    // Master Classes has conditional pricing
    await subscriptionPlansCollection.updateOne(
      { planId: 'MasterClases' },
      {
        $set: {
          'metadata.conditionalPricing': JSON.stringify({
            requiredPlans: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
            discountAmount: 177, // $177 discount
            discountedPrice: 2299, // $22.99 for community members
          }),
        },
      },
    );

    // Live Recorded is free with Live subscription
    await subscriptionPlansCollection.updateOne(
      { planId: 'LiveRecorded' },
      {
        $set: {
          'metadata.conditionalPricing': JSON.stringify({
            freeWithPlans: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
          }),
        },
      },
    );

    console.log(`\nMigration completed!`);
    console.log(`Successfully updated: ${updatedCount} plans`);
    console.log(`Errors: ${errorCount} plans`);

    // Show all plans with their Stripe IDs
    const allPlans = await subscriptionPlansCollection.find({}).toArray();
    console.log('\nAll subscription plans with Stripe IDs:');
    allPlans.forEach((plan) => {
      console.log(`- ${plan.planId}:`);
      console.log(`  Product ID: ${plan.stripeProductId || 'NOT SET'}`);
      console.log(`  Price ID: ${plan.stripePriceId || 'NOT SET'}`);
      console.log(`  Amount: $${(plan.amount || 0) / 100}`);
    });
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
populateSubscriptionPrices().catch(console.error);