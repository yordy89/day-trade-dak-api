/**
 * Create payload indexes for Qdrant collections
 * Required for filtering with strict mode enabled
 */
import { config } from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';

config();

async function createIndexes() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    console.error('QDRANT_URL and QDRANT_API_KEY required');
    process.exit(1);
  }

  const client = new QdrantClient({ url, apiKey });

  // Create indexes for both US and Spain collections
  const collections = ['daytradedak_us', 'daytradedak_spain'];

  const indexFields = [
    { name: 'isActive', type: 'bool' as const },
    { name: 'category', type: 'keyword' as const },
    { name: 'language', type: 'keyword' as const },
    { name: 'region', type: 'keyword' as const },
    { name: 'source', type: 'keyword' as const },
  ];

  for (const collection of collections) {
    console.log(`\nCreating indexes for collection: ${collection}`);

    // Check if collection exists
    try {
      await client.getCollection(collection);
    } catch (error) {
      console.log(`  Collection ${collection} doesn't exist, skipping`);
      continue;
    }

    for (const field of indexFields) {
      try {
        await client.createPayloadIndex(collection, {
          field_name: field.name,
          field_schema: field.type,
          wait: true,
        });
        console.log(`  ✓ Created index: ${field.name} (${field.type})`);
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.status === 400) {
          console.log(`  - Index already exists: ${field.name}`);
        } else {
          console.error(`  ✗ Failed to create index ${field.name}: ${error.message}`);
        }
      }
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

createIndexes().catch(console.error);
