import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

// Load environment variables
dotenv.config();

const logger = new Logger('FixStripeCustomerIdIndex');

async function fixStripeCustomerIdIndex() {
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    logger.error('MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    logger.log('Connecting to MongoDB...');
    await client.connect();
    logger.log('Connected successfully');

    const db = client.db();
    const collection = db.collection('users');

    // First, list existing indexes
    logger.log('Listing existing indexes on users collection...');
    const existingIndexes = await collection.indexes();
    
    const stripeCustomerIdIndex = existingIndexes.find(
      index => index.key && index.key.stripeCustomerId === 1
    );

    if (stripeCustomerIdIndex) {
      logger.log(`Found existing stripeCustomerId index: ${stripeCustomerIdIndex.name}`);
      
      // Drop the existing index
      logger.log('Dropping existing stripeCustomerId index...');
      await collection.dropIndex(stripeCustomerIdIndex.name);
      logger.log('Index dropped successfully');
    }

    // Create new sparse index
    logger.log('Creating new sparse index for stripeCustomerId...');
    await collection.createIndex(
      { stripeCustomerId: 1 },
      { 
        unique: true, 
        sparse: true, 
        name: 'stripeCustomerId_sparse' 
      }
    );
    logger.log('✅ New sparse index created successfully');

    // Verify the new index
    const updatedIndexes = await collection.indexes();
    const newIndex = updatedIndexes.find(
      index => index.key && index.key.stripeCustomerId === 1
    );
    
    if (newIndex && newIndex.sparse) {
      logger.log('✅ Verified: New index is sparse and unique');
      logger.log(`Index details: ${JSON.stringify(newIndex, null, 2)}`);
    } else {
      logger.error('❌ Error: New index was not created properly');
    }

    // Count users with null stripeCustomerId
    const nullCount = await collection.countDocuments({ stripeCustomerId: null });
    const undefinedCount = await collection.countDocuments({ stripeCustomerId: { $exists: false } });
    const totalUsers = await collection.countDocuments({});
    
    logger.log('\n📊 User statistics:');
    logger.log(`Total users: ${totalUsers}`);
    logger.log(`Users with null stripeCustomerId: ${nullCount}`);
    logger.log(`Users without stripeCustomerId field: ${undefinedCount}`);
    logger.log(`Users with stripeCustomerId: ${totalUsers - nullCount - undefinedCount}`);

  } catch (error) {
    logger.error('Failed to fix index:', error);
    process.exit(1);
  } finally {
    await client.close();
    logger.log('\n✅ Script completed successfully');
  }
}

// Run the script
fixStripeCustomerIdIndex().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});