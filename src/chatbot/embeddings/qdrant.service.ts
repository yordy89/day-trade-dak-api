import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v5 as uuidv5 } from 'uuid';

// Namespace for generating UUIDs from MongoDB IDs
const QDRANT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export interface QdrantDocument {
  [key: string]: unknown;
  id: string;
  title: string;
  content: string;
  category: string;
  language: string;
  region: string;
  tags: string[];
  source?: string;
  mongoId?: string;
  chunkIndex?: number;
  parentDocumentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: QdrantDocument;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient | null = null;
  private readonly collectionName: string;
  private readonly vectorSize = 1536; // OpenAI text-embedding-3-small
  private isAvailable = false;

  constructor(private configService: ConfigService) {
    this.collectionName =
      this.configService.get<string>('QDRANT_COLLECTION') || 'daytradedak_us';
  }

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const url = this.configService.get<string>('QDRANT_URL');
    const apiKey = this.configService.get<string>('QDRANT_API_KEY');

    if (!url || !apiKey) {
      this.logger.warn(
        'Qdrant configuration not found (QDRANT_URL, QDRANT_API_KEY). Vector search will use fallback.',
      );
      return;
    }

    try {
      this.client = new QdrantClient({ url, apiKey });
      await this.ensureCollection();
      this.isAvailable = true;
      this.logger.log(`Qdrant client initialized. Collection: ${this.collectionName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Qdrant client: ${error.message}`);
      this.client = null;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.client) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: { size: this.vectorSize, distance: 'Cosine' },
        });
        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        this.logger.log(`Qdrant collection exists: ${this.collectionName}`);
      }

      // Ensure payload indexes exist for filtering (required by Qdrant Cloud strict mode)
      await this.ensurePayloadIndexes();
    } catch (error) {
      this.logger.error('Failed to ensure Qdrant collection', error);
      throw error;
    }
  }

  /**
   * Create payload indexes for fields used in filters
   * Required for Qdrant Cloud with strict mode enabled
   */
  private async ensurePayloadIndexes(): Promise<void> {
    if (!this.client) return;

    const indexFields = [
      { name: 'isActive', type: 'bool' as const },
      { name: 'category', type: 'keyword' as const },
      { name: 'language', type: 'keyword' as const },
      { name: 'region', type: 'keyword' as const },
      { name: 'source', type: 'keyword' as const },
    ];

    for (const field of indexFields) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field.name,
          field_schema: field.type,
          wait: true,
        });
        this.logger.debug(`Created payload index: ${field.name}`);
      } catch (error: any) {
        // Index might already exist, which is fine
        if (!error.message?.includes('already exists')) {
          this.logger.warn(`Failed to create index for ${field.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Check if Qdrant is available
   */
  isQdrantAvailable(): boolean {
    return this.isAvailable && this.client !== null;
  }

  /**
   * Convert MongoDB ObjectID to Qdrant UUID
   */
  toQdrantId(mongoId: string): string {
    return uuidv5(mongoId, QDRANT_NAMESPACE);
  }

  /**
   * Upsert a document with its vector embedding
   */
  async upsert(id: string, vector: number[], payload: QdrantDocument): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    const qdrantId = this.toQdrantId(id);
    payload.id = qdrantId;

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id: qdrantId,
          vector,
          payload,
        },
      ],
    });

    this.logger.debug(`Upserted document to Qdrant: ${qdrantId}`);
  }

  /**
   * Upsert multiple documents in batch
   */
  async upsertBatch(
    points: Array<{ id: string; vector: number[]; payload: QdrantDocument }>,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    if (points.length === 0) return;

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });

    this.logger.debug(`Upserted ${points.length} documents to Qdrant`);
  }

  /**
   * Search for similar documents
   */
  async search(
    vector: number[],
    limit = 5,
    filter?: {
      category?: string;
      language?: string;
      region?: string;
      isActive?: boolean;
    },
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    // Build Qdrant filter
    const qdrantFilter: any = { must: [] };

    if (filter?.category) {
      qdrantFilter.must.push({
        key: 'category',
        match: { value: filter.category },
      });
    }

    if (filter?.language) {
      qdrantFilter.must.push({
        key: 'language',
        match: { value: filter.language },
      });
    }

    if (filter?.region) {
      qdrantFilter.must.push({
        key: 'region',
        match: { value: filter.region },
      });
    }

    if (filter?.isActive !== undefined) {
      qdrantFilter.must.push({
        key: 'isActive',
        match: { value: filter.isActive },
      });
    }

    // Default: only search active documents
    if (filter?.isActive === undefined) {
      qdrantFilter.must.push({
        key: 'isActive',
        match: { value: true },
      });
    }

    const searchParams: any = {
      vector,
      limit,
      with_payload: true,
    };

    if (qdrantFilter.must.length > 0) {
      searchParams.filter = qdrantFilter;
    }

    const results = await this.client.search(this.collectionName, searchParams);

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      payload: r.payload as QdrantDocument,
    }));
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    const qdrantId = this.toQdrantId(id);

    await this.client.delete(this.collectionName, {
      wait: true,
      points: [qdrantId],
    });

    this.logger.debug(`Deleted document from Qdrant: ${qdrantId}`);
  }

  /**
   * Delete multiple documents by IDs
   */
  async deleteBatch(ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    if (ids.length === 0) return;

    await this.client.delete(this.collectionName, {
      wait: true,
      points: ids,
    });

    this.logger.debug(`Deleted ${ids.length} documents from Qdrant`);
  }

  /**
   * Delete documents by filter (e.g., by source URL)
   */
  async deleteByFilter(filter: {
    source?: string;
    parentDocumentId?: string;
  }): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    const qdrantFilter: any = { must: [] };

    if (filter.source) {
      qdrantFilter.must.push({
        key: 'source',
        match: { value: filter.source },
      });
    }

    if (filter.parentDocumentId) {
      qdrantFilter.must.push({
        key: 'parentDocumentId',
        match: { value: filter.parentDocumentId },
      });
    }

    if (qdrantFilter.must.length === 0) {
      throw new Error('At least one filter criteria is required');
    }

    await this.client.delete(this.collectionName, {
      wait: true,
      filter: qdrantFilter,
    });

    this.logger.debug(`Deleted documents from Qdrant by filter: ${JSON.stringify(filter)}`);
  }

  /**
   * Get document count in collection
   */
  async getCount(): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const info = await this.client.getCollection(this.collectionName);
      return info.points_count || 0;
    } catch (error) {
      this.logger.error(`Failed to get document count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get a document by ID
   */
  async getById(id: string): Promise<QdrantDocument | null> {
    if (!this.client) {
      return null;
    }

    try {
      const qdrantId = this.toQdrantId(id);
      const results = await this.client.retrieve(this.collectionName, {
        ids: [qdrantId],
        with_payload: true,
      });

      if (results.length === 0) {
        return null;
      }

      return results[0].payload as QdrantDocument;
    } catch (error) {
      this.logger.error(`Failed to get document by ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Scroll through all documents (for migration/export)
   */
  async scrollAll(batchSize = 100): Promise<QdrantDocument[]> {
    if (!this.client) {
      return [];
    }

    const allDocuments: QdrantDocument[] = [];
    let offset: string | null = null;

    while (true) {
      const result = await this.client.scroll(this.collectionName, {
        limit: batchSize,
        offset: offset || undefined,
        with_payload: true,
      });

      for (const point of result.points) {
        allDocuments.push(point.payload as QdrantDocument);
      }

      if (!result.next_page_offset) {
        break;
      }

      offset = result.next_page_offset as string;
    }

    return allDocuments;
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection(): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    // Delete and recreate the collection
    await this.client.deleteCollection(this.collectionName);
    await this.client.createCollection(this.collectionName, {
      vectors: { size: this.vectorSize, distance: 'Cosine' },
    });

    this.logger.log(`Cleared Qdrant collection: ${this.collectionName}`);
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{
    name: string;
    pointsCount: number;
    vectorSize: number;
  } | null> {
    if (!this.client) {
      return null;
    }

    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: this.collectionName,
        pointsCount: info.points_count || 0,
        vectorSize: this.vectorSize,
      };
    } catch (error) {
      this.logger.error(`Failed to get collection info: ${error.message}`);
      return null;
    }
  }
}
