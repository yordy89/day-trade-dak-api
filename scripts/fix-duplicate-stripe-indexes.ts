import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixDuplicateIndexes() {
  const client = new MongoClient(process.env.MONGO_URI!);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');
    
    console.log('Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`));
    
    // Drop both stripe customer ID indexes
    try {
      console.log('\nDropping stripeCustomerId_1...');
      await collection.dropIndex('stripeCustomerId_1');
      console.log('✅ Dropped stripeCustomerId_1');
    } catch (e) {
      console.log('⚠️  stripeCustomerId_1 not found or already dropped');
    }
    
    try {
      console.log('\nDropping stripe_customer_id...');
      await collection.dropIndex('stripe_customer_id');
      console.log('✅ Dropped stripe_customer_id');
    } catch (e) {
      console.log('⚠️  stripe_customer_id not found or already dropped');
    }
    
    console.log('\n✅ Indexes cleaned up. Mongoose will recreate the correct one on restart.');
    
  } finally {
    await client.close();
  }
}

fixDuplicateIndexes().catch(console.error);