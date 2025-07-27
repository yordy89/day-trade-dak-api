import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

dotenv.config();

const logger = new Logger('FixDuplicateIndexes');

interface IndexFix {
  collection: string;
  field: string;
  reason: string;
}

// Collections where we have duplicate index definitions
const duplicateIndexes: IndexFix[] = [
  {
    collection: 'webhookevents',
    field: 'stripeEventId',
    reason: 'Defined in both @Prop and schema.index()',
  },
  {
    collection: 'subscription_plans',
    field: 'planId',
    reason: 'Defined in both @Prop and schema.index()',
  },
  {
    collection: 'permissions',
    field: 'userId',
    reason: 'Defined in both @Prop and schema.index()',
  },
];

// Fields that might need sparse index
const potentialSparseIndexes = [
  {
    collection: 'users',
    field: 'recoveryToken',
    reason: 'Optional field that might be null for most users',
  },
  {
    collection: 'users',
    field: 'fullName',
    reason: 'Optional field that might be null',
  },
];

async function fixAllDuplicateIndexes() {
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    logger.error('MONGO_URI is not defined');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    logger.log('Connected to MongoDB');
    const db = client.db();

    // Fix duplicate indexes
    for (const fix of duplicateIndexes) {
      logger.log(`\nChecking ${fix.collection} for duplicate ${fix.field} indexes...`);
      
      try {
        const collection = db.collection(fix.collection);
        const indexes = await collection.indexes();
        
        // Find all indexes for this field
        const fieldIndexes = indexes.filter(idx => 
          idx.key && idx.key[fix.field] !== undefined
        );
        
        if (fieldIndexes.length > 1) {
          logger.warn(`Found ${fieldIndexes.length} indexes for ${fix.field}:`);
          fieldIndexes.forEach(idx => {
            logger.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? 'UNIQUE' : ''} ${idx.sparse ? 'SPARSE' : ''}`);
          });
          
          // Keep the one created by Mongoose (usually ends with _1)
          const mongooseIndex = fieldIndexes.find(idx => idx.name === `${fix.field}_1`);
          if (mongooseIndex) {
            // Drop the others
            for (const idx of fieldIndexes) {
              if (idx.name !== mongooseIndex.name) {
                logger.log(`  Dropping duplicate index: ${idx.name}`);
                await collection.dropIndex(idx.name!);
              }
            }
          }
        } else if (fieldIndexes.length === 1) {
          logger.log(`✅ Only one index found for ${fix.field} - no duplicates`);
        } else {
          logger.log(`⚠️  No index found for ${fix.field}`);
        }
      } catch (error) {
        logger.error(`Error processing ${fix.collection}: ${error.message}`);
      }
    }

    // List all unique indexes to check for potential issues
    logger.log('\n📊 Checking all unique indexes for potential null value issues...\n');
    
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const collection = db.collection(col.name);
      const indexes = await collection.indexes();
      
      const uniqueIndexes = indexes.filter(idx => idx.unique && !idx.sparse);
      if (uniqueIndexes.length > 0) {
        logger.log(`${col.name}:`);
        uniqueIndexes.forEach(idx => {
          if (idx.name !== '_id_') { // Skip the default _id index
            logger.warn(`  ⚠️  ${idx.name}: ${JSON.stringify(idx.key)} - UNIQUE but NOT SPARSE`);
          }
        });
      }
    }

    logger.log('\n✅ Index analysis complete!');
    
  } catch (error) {
    logger.error('Failed to fix indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

fixAllDuplicateIndexes().catch(console.error);