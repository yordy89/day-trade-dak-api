/**
 * Test script: Verify Qdrant search is working
 */
import { config } from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

config();

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'daytradedak_us';
const OPENAI_KEY = process.env.OPENAI_KEY;

async function testSearch() {
  console.log('='.repeat(60));
  console.log('Testing Qdrant Search');
  console.log('='.repeat(60));
  console.log(`Qdrant URL: ${QDRANT_URL}`);
  console.log(`Collection: ${QDRANT_COLLECTION}`);
  console.log('');

  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.error('ERROR: QDRANT_URL and QDRANT_API_KEY not configured');
    process.exit(1);
  }

  if (!OPENAI_KEY) {
    console.error('ERROR: OPENAI_KEY not configured');
    process.exit(1);
  }

  // Initialize clients
  const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  // Check collection
  console.log('1. Checking Qdrant collection...');
  const collectionInfo = await qdrant.getCollection(QDRANT_COLLECTION);
  console.log(`   Points count: ${collectionInfo.points_count}`);
  console.log(`   Status: ${collectionInfo.status}`);

  if (collectionInfo.points_count === 0) {
    console.error('\nERROR: Collection is empty! Documents were not migrated.');
    process.exit(1);
  }

  // Test query
  const testQuery = 'como creo una cuenta?';
  console.log(`\n2. Testing search for: "${testQuery}"`);

  // Generate embedding
  console.log('   Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: testQuery,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`   Embedding generated (${queryEmbedding.length} dimensions)`);

  // Search Qdrant
  console.log('   Searching Qdrant...');
  const results = await qdrant.search(QDRANT_COLLECTION, {
    vector: queryEmbedding,
    limit: 10,
    with_payload: true,
    filter: {
      must: [{ key: 'isActive', match: { value: true } }],
    },
  });

  console.log(`   Found ${results.length} results\n`);

  if (results.length > 0) {
    console.log('Results:');
    results.forEach((r, i) => {
      const payload = r.payload as any;
      console.log(`\n[${i + 1}] Score: ${r.score.toFixed(4)}`);
      console.log(`    Title: ${payload.title}`);
      console.log(`    Language: ${payload.language}`);
      console.log(`    Region: ${payload.region}`);
      console.log(`    Category: ${payload.category}`);
    });
  } else {
    console.log('No results found!');
  }

  // Test another query in English
  const testQuery2 = 'how do I create an account?';
  console.log(`\n\n3. Testing search for: "${testQuery2}"`);

  const embeddingResponse2 = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: testQuery2,
  });
  const queryEmbedding2 = embeddingResponse2.data[0].embedding;

  const results2 = await qdrant.search(QDRANT_COLLECTION, {
    vector: queryEmbedding2,
    limit: 5,
    with_payload: true,
    filter: {
      must: [{ key: 'isActive', match: { value: true } }],
    },
  });

  console.log(`   Found ${results2.length} results\n`);

  if (results2.length > 0) {
    console.log('Results:');
    results2.forEach((r, i) => {
      const payload = r.payload as any;
      console.log(`\n[${i + 1}] Score: ${r.score.toFixed(4)}`);
      console.log(`    Title: ${payload.title}`);
      console.log(`    Language: ${payload.language}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Search test complete!');
  console.log('='.repeat(60));

  process.exit(0);
}

testSearch().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
