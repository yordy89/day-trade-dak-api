/**
 * Migration Script: MongoDB to Qdrant
 *
 * This script migrates existing knowledge documents from MongoDB to Qdrant.
 * It preserves all documents in MongoDB (as source of truth) and copies
 * the embeddings to Qdrant for vector search.
 *
 * Usage:
 *   npx ts-node src/chatbot/scripts/migrate-to-qdrant.ts
 *
 * Required Environment Variables:
 *   - MONGODB_URI: MongoDB connection string
 *   - QDRANT_URL: Qdrant Cloud URL (e.g., https://your-cluster.qdrant.io)
 *   - QDRANT_API_KEY: Qdrant API key
 *   - QDRANT_COLLECTION: Collection name (default: daytradedak_us)
 */

import { config } from 'dotenv';
import { connect, model, Schema, Document } from 'mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v5 as uuidv5 } from 'uuid';

// Namespace for generating UUIDs from MongoDB IDs
const QDRANT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Load environment variables
config();

// MongoDB Schema (simplified for migration)
interface IKnowledgeDocument extends Document {
  region: string;
  category: string;
  title: string;
  content: string;
  embedding: number[];
  metadata: {
    language: string;
    lastUpdated: Date;
    version: number;
    tags?: string[];
    source?: string;
  };
  isActive: boolean;
  chunkIndex?: number;
  parentDocumentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocumentSchema = new Schema(
  {
    region: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: {
      language: { type: String, required: true },
      lastUpdated: { type: Date, required: true },
      version: { type: Number, default: 1 },
      tags: { type: [String], default: [] },
      source: { type: String },
    },
    isActive: { type: Boolean, default: true },
    chunkIndex: { type: Number },
    parentDocumentId: { type: String },
  },
  { timestamps: true },
);

const KnowledgeDocument = model<IKnowledgeDocument>(
  'KnowledgeDocument',
  KnowledgeDocumentSchema,
);

// Qdrant Document interface
interface QdrantPayload {
  [key: string]: unknown;
  id: string;
  title: string;
  content: string;
  category: string;
  language: string;
  region: string;
  tags: string[];
  source?: string;
  mongoId: string;
  chunkIndex?: number;
  parentDocumentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  const collectionName = process.env.QDRANT_COLLECTION || 'daytradedak_us';
  const vectorSize = 1536;

  // Validate environment variables
  if (!mongoUri) {
    console.error('Error: MONGODB_URI or MONGO_URI environment variable is required');
    process.exit(1);
  }

  if (!qdrantUrl || !qdrantApiKey) {
    console.error(
      'Error: QDRANT_URL and QDRANT_API_KEY environment variables are required',
    );
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('MongoDB to Qdrant Migration (US API)');
  console.log('='.repeat(60));
  console.log(`Qdrant URL: ${qdrantUrl}`);
  console.log(`Collection: ${collectionName}`);
  console.log('');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected to MongoDB');

    // Initialize Qdrant client
    console.log('Connecting to Qdrant...');
    const qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    // Check if collection exists, create if not
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (c) => c.name === collectionName,
    );

    if (!collectionExists) {
      console.log(`Creating Qdrant collection: ${collectionName}`);
      await qdrantClient.createCollection(collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
      console.log('Collection created');
    } else {
      console.log(`Qdrant collection already exists: ${collectionName}`);
    }

    // Get current Qdrant count
    const beforeInfo = await qdrantClient.getCollection(collectionName);
    console.log(`Current Qdrant document count: ${beforeInfo.points_count}`);

    // Fetch all active documents from MongoDB
    console.log('\nFetching documents from MongoDB...');
    const documents = await KnowledgeDocument.find({ isActive: true });
    console.log(`Found ${documents.length} active documents in MongoDB`);

    // Filter documents with embeddings
    const docsWithEmbeddings = documents.filter(
      (doc) => doc.embedding && doc.embedding.length > 0,
    );
    const docsWithoutEmbeddings = documents.filter(
      (doc) => !doc.embedding || doc.embedding.length === 0,
    );

    console.log(`Documents with embeddings: ${docsWithEmbeddings.length}`);
    console.log(`Documents without embeddings: ${docsWithoutEmbeddings.length}`);

    if (docsWithoutEmbeddings.length > 0) {
      console.log('\nDocuments without embeddings (will be skipped):');
      docsWithoutEmbeddings.slice(0, 5).forEach((doc) => {
        console.log(`  - ${doc.title} (${doc._id})`);
      });
      if (docsWithoutEmbeddings.length > 5) {
        console.log(`  ... and ${docsWithoutEmbeddings.length - 5} more`);
      }
    }

    // Migrate documents in batches
    const batchSize = 100;
    let migrated = 0;
    let errors = 0;

    console.log(`\nMigrating ${docsWithEmbeddings.length} documents...`);
    console.log(`Batch size: ${batchSize}`);
    console.log('');

    for (let i = 0; i < docsWithEmbeddings.length; i += batchSize) {
      const batch = docsWithEmbeddings.slice(i, i + batchSize);

      const points = batch.map((doc) => {
        const mongoId = doc._id.toString();
        const qdrantId = uuidv5(mongoId, QDRANT_NAMESPACE);
        return {
          id: qdrantId,
          vector: doc.embedding,
          payload: {
            id: qdrantId,
          title: doc.title,
          content: doc.content,
          category: doc.category,
          language: doc.metadata?.language || 'en',
          region: doc.region,
          tags: doc.metadata?.tags || [],
          source: doc.metadata?.source,
          mongoId: doc._id.toString(),
          chunkIndex: doc.chunkIndex,
          parentDocumentId: doc.parentDocumentId,
          isActive: doc.isActive,
          createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
        } as QdrantPayload,
        };
      });

      try {
        await qdrantClient.upsert(collectionName, {
          wait: true,
          points,
        });
        migrated += batch.length;
        console.log(
          `Migrated batch ${Math.floor(i / batchSize) + 1}: ${migrated}/${docsWithEmbeddings.length} documents`,
        );
      } catch (error: any) {
        console.error(`Error migrating batch: ${error.message}`);
        errors += batch.length;
      }
    }

    // Get final Qdrant count
    const afterInfo = await qdrantClient.getCollection(collectionName);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Complete');
    console.log('='.repeat(60));
    console.log(`Total documents in MongoDB: ${documents.length}`);
    console.log(`Documents with embeddings: ${docsWithEmbeddings.length}`);
    console.log(`Successfully migrated: ${migrated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Skipped (no embeddings): ${docsWithoutEmbeddings.length}`);
    console.log(`Qdrant documents before: ${beforeInfo.points_count}`);
    console.log(`Qdrant documents after: ${afterInfo.points_count}`);
    console.log('');

    if (errors > 0) {
      console.log(
        'Warning: Some documents failed to migrate. Check the logs above for details.',
      );
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migrate();
