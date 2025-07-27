import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

// Load environment variables
dotenv.config();

const logger = new Logger('CreateIndexes');

interface IndexDefinition {
  collection: string;
  index: any;
  options?: any;
}

const indexes: IndexDefinition[] = [
  // User indexes
  {
    collection: 'users',
    index: { email: 1 },
    options: { unique: true, name: 'email_unique' },
  },
  // Removed stripeCustomerId index - let Mongoose handle it from schema
  // {
  //   collection: 'users',
  //   index: { stripeCustomerId: 1 },
  //   options: { sparse: true, name: 'stripe_customer_id' },
  // },
  {
    collection: 'users',
    index: { activeSubscriptions: 1 },
    options: { name: 'active_subscriptions' },
  },
  {
    collection: 'users',
    index: { createdAt: -1 },
    options: { name: 'created_at_desc' },
  },
  {
    collection: 'users',
    index: { email: 1, isActive: 1 },
    options: { name: 'email_active_compound' },
  },
  {
    collection: 'users',
    index: { role: 1, createdAt: -1 },
    options: { name: 'role_created_compound' },
  },
  {
    collection: 'users',
    index: { firstName: 'text', lastName: 'text', email: 'text' },
    options: { name: 'user_text_search' },
  },

  // Transaction indexes (already exist but included for completeness)
  {
    collection: 'transactions',
    index: { userId: 1, createdAt: -1 },
    options: { name: 'user_created_compound' },
  },
  {
    collection: 'transactions',
    index: { stripePaymentIntentId: 1 },
    options: { name: 'stripe_payment_intent' },
  },
  {
    collection: 'transactions',
    index: { status: 1 },
    options: { name: 'transaction_status' },
  },
  {
    collection: 'transactions',
    index: { createdAt: -1 },
    options: { name: 'created_at_desc' },
  },

  // Event indexes
  {
    collection: 'events',
    index: { startDate: 1 },
    options: { name: 'event_start_date' },
  },
  {
    collection: 'events',
    index: { endDate: 1 },
    options: { name: 'event_end_date' },
  },
  {
    collection: 'events',
    index: { isActive: 1, startDate: 1 },
    options: { name: 'active_events_compound' },
  },
  {
    collection: 'events',
    index: { createdAt: -1 },
    options: { name: 'created_at_desc' },
  },

  // Event Registration indexes
  {
    collection: 'eventregistrations',
    index: { eventId: 1, userId: 1 },
    options: { unique: true, name: 'event_user_unique' },
  },
  {
    collection: 'eventregistrations',
    index: { userId: 1 },
    options: { name: 'user_registrations' },
  },
  {
    collection: 'eventregistrations',
    index: { eventId: 1 },
    options: { name: 'event_registrations' },
  },

  // Company indexes
  {
    collection: 'companies',
    index: { symbol: 1 },
    options: { unique: true, name: 'symbol_unique' },
  },
  {
    collection: 'companies',
    index: { name: 'text', symbol: 'text' },
    options: { name: 'company_text_search' },
  },

  // Video indexes
  {
    collection: 'videos',
    index: { category: 1, createdAt: -1 },
    options: { name: 'category_created_compound' },
  },
  {
    collection: 'videos',
    index: { isActive: 1 },
    options: { name: 'active_videos' },
  },
  {
    collection: 'videos',
    index: { title: 'text', description: 'text' },
    options: { name: 'video_text_search' },
  },

  // Video Class indexes
  {
    collection: 'videoclasses',
    index: { userId: 1 },
    options: { name: 'user_video_classes' },
  },
  {
    collection: 'videoclasses',
    index: { videoId: 1 },
    options: { name: 'video_classes' },
  },
  {
    collection: 'videoclasses',
    index: { userId: 1, videoId: 1 },
    options: { unique: true, name: 'user_video_unique' },
  },

  // Trade indexes
  {
    collection: 'trades',
    index: { userId: 1, createdAt: -1 },
    options: { name: 'user_trades_compound' },
  },
  {
    collection: 'trades',
    index: { symbol: 1 },
    options: { name: 'trade_symbol' },
  },
  {
    collection: 'trades',
    index: { status: 1 },
    options: { name: 'trade_status' },
  },

  // Mission indexes
  {
    collection: 'missions',
    index: { userId: 1, status: 1 },
    options: { name: 'user_mission_status' },
  },
  {
    collection: 'missions',
    index: { type: 1 },
    options: { name: 'mission_type' },
  },
  {
    collection: 'missions',
    index: { createdAt: -1 },
    options: { name: 'created_at_desc' },
  },
];

async function createIndexes() {
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

    for (const indexDef of indexes) {
      try {
        logger.log(`Creating index on ${indexDef.collection}: ${JSON.stringify(indexDef.index)}`);
        
        const collection = db.collection(indexDef.collection);
        await collection.createIndex(indexDef.index, indexDef.options);
        
        logger.log(`✅ Index created successfully on ${indexDef.collection}`);
      } catch (error) {
        if (error.code === 11000 || error.code === 85) {
          logger.warn(`⚠️  Index already exists on ${indexDef.collection}`);
        } else {
          logger.error(`❌ Failed to create index on ${indexDef.collection}: ${error.message}`);
        }
      }
    }

    // List all indexes for verification
    logger.log('\n📊 Listing all indexes by collection:');
    
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const collection = db.collection(col.name);
      const existingIndexes = await collection.indexes();
      
      logger.log(`\n${col.name}:`);
      existingIndexes.forEach((index) => {
        logger.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    }

    logger.log('\n✅ Index creation script completed successfully');
  } catch (error) {
    logger.error('Failed to create indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createIndexes().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});