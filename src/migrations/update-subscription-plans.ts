import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

// Map old plans to new plans
const PLAN_MAPPING = {
  Free: null, // Remove FREE subscriptions
  Basic: 'MasterClases', // BASIC -> MASTER_CLASES
  Pro: null, // Remove PRO
  Enterprise: null, // Remove ENTERPRISE
  Mentorship: 'MasterClases', // MENTORSHIP -> MASTER_CLASES
  Class: 'LiveRecorded', // CLASS -> LIVE_RECORDED
  Stock: null, // Remove STOCK
  Psicotrading: 'Psicotrading', // Keep as is
  MoneyPeace: 'PeaceWithMoney', // MONEYPEACE -> PEACE_WITH_MONEY
  Clases: 'Classes', // CLASES -> CLASSES
  // Keep these as is
  LiveWeeklyManual: 'LiveWeeklyManual',
  LiveWeeklyRecurring: 'LiveWeeklyRecurring',
  MasterCourse: 'MasterCourse',
  CommunityEvent: 'CommunityEvent',
};

async function migrateSubscriptions() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const usersCollection = db.collection('users');

    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} users to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Update subscriptions array
        const updatedSubscriptions = [];

        if (user.subscriptions && Array.isArray(user.subscriptions)) {
          for (const sub of user.subscriptions) {
            const oldPlan = sub.plan || sub; // Handle both object and string formats
            const newPlan = PLAN_MAPPING[oldPlan];

            if (newPlan) {
              // Keep the subscription with new plan name
              if (typeof sub === 'object') {
                updatedSubscriptions.push({
                  ...sub,
                  plan: newPlan,
                });
              } else {
                updatedSubscriptions.push({
                  plan: newPlan,
                });
              }
            }
            // If newPlan is null, we skip it (remove it)
          }
        }

        // Update the user
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              subscriptions: updatedSubscriptions,
              // Remove customClassAccess field
              customClassAccess: undefined,
            },
            $unset: {
              customClassAccess: '',
            },
          },
        );

        migratedCount++;

        if (migratedCount % 100 === 0) {
          console.log(`Migrated ${migratedCount} users...`);
        }
      } catch (error) {
        console.error(`Error migrating user ${user._id}:`, error);
        errorCount++;
      }
    }

    console.log(`\nMigration completed!`);
    console.log(`Successfully migrated: ${migratedCount} users`);
    console.log(`Errors: ${errorCount} users`);

    // Show summary of changes
    console.log('\nSubscription plan changes:');
    console.log('- FREE -> Removed');
    console.log('- BASIC -> MASTER_CLASES');
    console.log('- PRO -> Removed');
    console.log('- ENTERPRISE -> Removed');
    console.log('- MENTORSHIP -> MASTER_CLASES');
    console.log('- CLASS -> LIVE_RECORDED');
    console.log('- STOCK -> Removed');
    console.log('- MONEYPEACE -> PEACE_WITH_MONEY');
    console.log('- CLASES -> CLASSES');
    console.log('- customClassAccess field -> Removed');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
migrateSubscriptions().catch(console.error);
