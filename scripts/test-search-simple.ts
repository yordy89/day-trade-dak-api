/**
 * Simple test: Verify Qdrant search without filters
 */
import { config } from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

config();

async function test() {
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
  const collection = process.env.QDRANT_COLLECTION || 'daytradedak_us';

  console.log('Collection:', collection);

  // Get a sample point to see its structure
  console.log('\n1. Getting sample point structure...');
  const scrollResult = await qdrant.scroll(collection, {
    limit: 1,
    with_payload: true,
    with_vector: true,
  });

  if (scrollResult.points.length > 0) {
    const samplePoint = scrollResult.points[0];
    console.log('Sample point ID:', samplePoint.id);
    console.log('Vector length:', (samplePoint.vector as number[]).length);
    console.log('Payload keys:', Object.keys(samplePoint.payload));
    console.log('Payload:', JSON.stringify(samplePoint.payload, null, 2));
  }

  // Generate embedding for test query
  console.log('\n2. Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'como creo una cuenta?',
  });
  const queryVector = embeddingResponse.data[0].embedding;
  console.log('Query vector length:', queryVector.length);

  // Try search without filter
  console.log('\n3. Searching without filter...');
  try {
    const results = await qdrant.search(collection, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
    });
    console.log('Results:', results.length);
    results.forEach((r, i) => {
      console.log(`  [${i + 1}] score=${r.score.toFixed(4)} title="${(r.payload as any).title}"`);
    });
  } catch (err: any) {
    console.error('Search error:', err.message);
  }

  // Try search with simple filter
  console.log('\n4. Searching with isActive filter...');
  try {
    const results = await qdrant.search(collection, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
      filter: {
        must: [{ key: 'isActive', match: { value: true } }],
      },
    });
    console.log('Results:', results.length);
    results.forEach((r, i) => {
      console.log(`  [${i + 1}] score=${r.score.toFixed(4)} title="${(r.payload as any).title}"`);
    });
  } catch (err: any) {
    console.error('Search with filter error:', err.message);
  }

  process.exit(0);
}

test().catch(console.error);
