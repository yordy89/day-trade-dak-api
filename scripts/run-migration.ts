import { migrateSubscriptionPlans } from '../src/migrations/populate-complete-subscription-data';

// Run the migration
migrateSubscriptionPlans()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });