import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as pdfParse from 'pdf-parse';
import {
  KnowledgeDocument,
  KnowledgeDocumentDocument,
  KnowledgeCategory,
  RegionType,
  LanguageType,
} from '../schemas/knowledge-document.schema';
import {
  UrlSource,
  UrlSourceDocument,
  CrawlStatus,
} from '../schemas/url-source.schema';
import { EmbeddingsService } from './embeddings.service';
import { QdrantService, QdrantDocument } from './qdrant.service';
import { UploadPdfDto, AddUrlDocumentDto } from '../dto/chat-message.dto';
import { UrlCrawlerService } from '../services/url-crawler.service';

export interface SearchResult {
  document: KnowledgeDocumentDocument;
  score: number;
}

export interface SearchOptions {
  region?: string;
  language?: string;
  category?: KnowledgeCategory;
  limit?: number;
  minScore?: number;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @InjectModel(KnowledgeDocument.name)
    private knowledgeModel: Model<KnowledgeDocumentDocument>,
    @InjectModel(UrlSource.name)
    private urlSourceModel: Model<UrlSourceDocument>,
    private readonly embeddingsService: EmbeddingsService,
    private readonly qdrantService: QdrantService,
    private readonly urlCrawlerService: UrlCrawlerService,
  ) {}

  /**
   * Add a document to the knowledge base (MongoDB + Qdrant)
   */
  async addDocument(
    title: string,
    content: string,
    options: {
      region: RegionType;
      category: KnowledgeCategory;
      language: LanguageType;
      tags?: string[];
      source?: string;
      isActive?: boolean;
    },
  ): Promise<KnowledgeDocumentDocument> {
    try {
      // Chunk the content if it's too long
      const chunks = this.embeddingsService.chunkText(content, 500);

      if (chunks.length === 1) {
        // Single document
        const embedding = await this.embeddingsService.generateEmbedding(
          `${title}\n\n${content}`,
        );

        const document = new this.knowledgeModel({
          region: options.region,
          category: options.category,
          title,
          content,
          embedding,
          metadata: {
            language: options.language,
            lastUpdated: new Date(),
            version: 1,
            tags: options.tags || [],
            source: options.source,
          },
          isActive: options.isActive !== undefined ? options.isActive : true,
        });

        const savedDoc = await document.save();

        // Sync to Qdrant
        await this.syncToQdrant(savedDoc, embedding);

        return savedDoc;
      }

      // Multiple chunks - create parent and child documents
      const documents: KnowledgeDocumentDocument[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        const embedding = await this.embeddingsService.generateEmbedding(
          `${title}\n\n${chunkContent}`,
        );

        const document = new this.knowledgeModel({
          region: options.region,
          category: options.category,
          title: `${title} (Part ${i + 1}/${chunks.length})`,
          content: chunkContent,
          embedding,
          metadata: {
            language: options.language,
            lastUpdated: new Date(),
            version: 1,
            tags: options.tags || [],
            source: options.source,
          },
          isActive: options.isActive !== undefined ? options.isActive : true,
          chunkIndex: i,
          parentDocumentId: title,
        });

        const savedDoc = await document.save();

        // Sync to Qdrant
        await this.syncToQdrant(savedDoc, embedding);

        documents.push(savedDoc);
      }

      return documents[0];
    } catch (error) {
      this.logger.error(`Failed to add document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync a MongoDB document to Qdrant
   */
  private async syncToQdrant(
    doc: KnowledgeDocumentDocument,
    embedding: number[],
  ): Promise<void> {
    if (!this.qdrantService.isQdrantAvailable()) {
      this.logger.debug('Qdrant not available, skipping sync');
      return;
    }

    try {
      const qdrantDoc: QdrantDocument = {
        id: doc._id.toString(),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.qdrantService.upsert(doc._id.toString(), embedding, qdrantDoc);
    } catch (error) {
      this.logger.error(`Failed to sync document to Qdrant: ${error.message}`);
      // Don't throw - MongoDB is the source of truth
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilar(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    try {
      const {
        region,
        language,
        category,
        limit = 5,
        minScore = 0.7,
      } = options;

      this.logger.log(`[SEARCH] Query: "${query.substring(0, 50)}..." | MinScore: ${minScore}`);

      // Generate query embedding
      const queryEmbedding =
        await this.embeddingsService.generateEmbedding(query);

      // Try Qdrant first if available
      if (this.qdrantService.isQdrantAvailable()) {
        try {
          this.logger.log('[SEARCH] Using Qdrant vector search...');

          const qdrantResults = await this.qdrantService.search(
            queryEmbedding,
            limit * 2, // Get more results to filter by minScore
            {
              category: category,
              isActive: true,
            },
          );

          this.logger.log(`[SEARCH] Qdrant returned ${qdrantResults.length} results`);

          if (qdrantResults.length > 0) {
            qdrantResults.forEach((r, i) => {
              this.logger.log(
                `[SEARCH]   [${i + 1}] score=${r.score.toFixed(4)} title="${r.payload.title}" (${r.score >= minScore ? 'PASS' : 'FILTERED OUT'})`,
              );
            });
          }

          // Filter by minScore and limit
          const filteredResults = qdrantResults
            .filter((r) => r.score >= minScore)
            .slice(0, limit);

          this.logger.log(
            `[SEARCH] After minScore filter (>=${minScore}): ${filteredResults.length} results`,
          );

          // Convert Qdrant results to SearchResult format
          return filteredResults.map((r) => ({
            document: {
              _id: new Types.ObjectId(r.payload.mongoId || r.id),
              title: r.payload.title,
              content: r.payload.content,
              category: r.payload.category as KnowledgeCategory,
              region: r.payload.region as RegionType,
              metadata: {
                language: r.payload.language as LanguageType,
                tags: r.payload.tags,
                source: r.payload.source,
                lastUpdated: new Date(r.payload.updatedAt),
                version: 1,
              },
              isActive: r.payload.isActive,
              chunkIndex: r.payload.chunkIndex,
              parentDocumentId: r.payload.parentDocumentId,
              embedding: [], // Not needed for search results
            } as unknown as KnowledgeDocumentDocument,
            score: r.score,
          }));
        } catch (qdrantError) {
          this.logger.warn(
            `[SEARCH] Qdrant search failed: ${qdrantError.message}, falling back to in-memory`,
          );
        }
      }

      // Fallback: Check MongoDB document count
      const totalDocs = await this.knowledgeModel.countDocuments({ isActive: true });
      this.logger.log(`[SEARCH] Total active documents in MongoDB: ${totalDocs}`);

      if (totalDocs === 0) {
        this.logger.warn('[SEARCH] No documents in database! Knowledge base is empty.');
        return [];
      }

      // Build filter
      const standardFilter: any = { isActive: true };
      if (category) {
        standardFilter.category = category;
      }

      // Try MongoDB Atlas Vector Search
      try {
        this.logger.log('[SEARCH] Attempting Atlas Vector Search...');

        const allResults = await this.knowledgeModel.aggregate([
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: limit * 10,
              limit: limit * 2,
              filter: { isActive: true, ...(category && { category }) },
            },
          },
          {
            $addFields: {
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ]);

        this.logger.log(`[SEARCH] Atlas Vector Search returned ${allResults.length} results`);

        if (allResults.length > 0) {
          allResults.forEach((doc: any, i: number) => {
            this.logger.log(
              `[SEARCH]   [${i + 1}] score=${doc.score?.toFixed(4)} title="${doc.title}" (${doc.score >= minScore ? 'PASS' : 'FILTERED OUT'})`,
            );
          });
        }

        const filteredResults = allResults.filter((doc: any) => doc.score >= minScore);
        this.logger.log(`[SEARCH] After minScore filter (>=${minScore}): ${filteredResults.length} results`);

        return filteredResults.slice(0, limit).map((doc: any) => ({
          document: doc,
          score: doc.score,
        }));
      } catch (searchError: any) {
        this.logger.warn(
          `[SEARCH] Atlas Vector Search failed (${searchError.message}), using in-memory similarity`,
        );
        return this.inMemorySearch(queryEmbedding, standardFilter, limit, minScore);
      }
    } catch (error) {
      this.logger.error(`[SEARCH] Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fallback in-memory similarity search
   */
  private async inMemorySearch(
    queryEmbedding: number[],
    filter: any,
    limit: number,
    minScore: number,
  ): Promise<SearchResult[]> {
    this.logger.log('[IN-MEMORY SEARCH] Starting in-memory similarity search...');

    const simpleFilter: any = { isActive: true };
    if (filter.category) {
      simpleFilter.category = filter.category;
    }

    const documents = await this.knowledgeModel.find(simpleFilter);
    this.logger.log(`[IN-MEMORY SEARCH] Found ${documents.length} documents matching filter`);

    const docsWithEmbeddings = documents.filter((doc) => doc.embedding && doc.embedding.length > 0);
    const docsWithoutEmbeddings = documents.filter((doc) => !doc.embedding || doc.embedding.length === 0);

    if (docsWithoutEmbeddings.length > 0) {
      this.logger.warn(`[IN-MEMORY SEARCH] ${docsWithoutEmbeddings.length} documents have NO embeddings!`);
    }

    this.logger.log(`[IN-MEMORY SEARCH] ${docsWithEmbeddings.length} documents have embeddings`);

    const results: SearchResult[] = docsWithEmbeddings.map((doc) => ({
      document: doc,
      score: this.embeddingsService.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    results.sort((a, b) => b.score - a.score);
    this.logger.log(`[IN-MEMORY SEARCH] Similarity scores (top 10):`);
    results.slice(0, 10).forEach((r, i) => {
      this.logger.log(
        `[IN-MEMORY SEARCH]   [${i + 1}] score=${r.score.toFixed(4)} title="${r.document.title}" (${r.score >= minScore ? 'PASS' : 'FILTERED OUT'})`,
      );
    });

    const filteredResults = results.filter((r) => r.score >= minScore).slice(0, limit);
    this.logger.log(`[IN-MEMORY SEARCH] After minScore filter (>=${minScore}): ${filteredResults.length} results`);

    return filteredResults;
  }

  /**
   * Update a document (regenerates embedding if content changed)
   */
  async updateDocument(
    id: string,
    updates: {
      title?: string;
      content?: string;
      region?: string;
      category?: string;
      language?: string;
      tags?: string[];
      isActive?: boolean;
    },
  ): Promise<KnowledgeDocumentDocument | null> {
    try {
      const document = await this.knowledgeModel.findById(id);

      if (!document) {
        return null;
      }

      let needsNewEmbedding = false;

      if (updates.title !== undefined) {
        document.title = updates.title;
        needsNewEmbedding = true;
      }

      if (updates.content !== undefined) {
        document.content = updates.content;
        needsNewEmbedding = true;
      }

      if (updates.region !== undefined) {
        document.region = updates.region as any;
      }

      if (updates.category !== undefined) {
        document.category = updates.category as any;
      }

      if (updates.language !== undefined) {
        document.metadata.language = updates.language as any;
      }

      if (updates.tags !== undefined) {
        document.metadata.tags = updates.tags;
      }

      if (updates.isActive !== undefined) {
        document.isActive = updates.isActive;
      }

      let embedding = document.embedding;
      if (needsNewEmbedding) {
        embedding = await this.embeddingsService.generateEmbedding(
          `${document.title}\n\n${document.content}`,
        );
        document.embedding = embedding;
        document.metadata.version += 1;
      }

      document.metadata.lastUpdated = new Date();
      const savedDoc = await document.save();

      // Sync to Qdrant
      await this.syncToQdrant(savedDoc, embedding);

      return savedDoc;
    } catch (error) {
      this.logger.error(`Failed to update document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.knowledgeModel.deleteOne({ _id: id });

    // Delete from Qdrant
    if (this.qdrantService.isQdrantAvailable()) {
      try {
        await this.qdrantService.delete(id);
      } catch (error) {
        this.logger.error(`Failed to delete from Qdrant: ${error.message}`);
      }
    }

    return result.deletedCount > 0;
  }

  /**
   * Get all documents (for admin)
   */
  async getAllDocuments(filter?: {
    region?: string;
    category?: string;
    language?: string;
    isActive?: boolean;
  }): Promise<KnowledgeDocumentDocument[]> {
    const query: any = {};

    if (filter?.region) query.region = filter.region;
    if (filter?.category) query.category = filter.category;
    if (filter?.language) query['metadata.language'] = filter.language;
    if (filter?.isActive !== undefined) query.isActive = filter.isActive;

    return this.knowledgeModel
      .find(query)
      .select('-embedding')
      .sort({ 'metadata.lastUpdated': -1 })
      .exec();
  }

  /**
   * Get document count by category
   */
  async getDocumentStats(): Promise<any> {
    const mongoStats = await this.knowledgeModel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { category: '$category', region: '$region' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          regions: {
            $push: { region: '$_id.region', count: '$count' },
          },
          total: { $sum: '$count' },
        },
      },
    ]);

    // Add Qdrant stats if available
    let qdrantCount = 0;
    let qdrantInfo = null;
    if (this.qdrantService.isQdrantAvailable()) {
      qdrantCount = await this.qdrantService.getCount();
      qdrantInfo = await this.qdrantService.getCollectionInfo();
    }

    return {
      categories: mongoStats,
      qdrant: {
        available: this.qdrantService.isQdrantAvailable(),
        count: qdrantCount,
        info: qdrantInfo,
      },
    };
  }

  /**
   * Reindex all documents (regenerate embeddings and sync to Qdrant)
   */
  async reindexAll(): Promise<{ processed: number; errors: number; qdrantSynced: number }> {
    const documents = await this.knowledgeModel.find({ isActive: true });
    let processed = 0;
    let errors = 0;
    let qdrantSynced = 0;

    for (const doc of documents) {
      try {
        const embedding = await this.embeddingsService.generateEmbedding(
          `${doc.title}\n\n${doc.content}`,
        );
        doc.embedding = embedding;
        doc.metadata.lastUpdated = new Date();
        await doc.save();
        processed++;

        // Sync to Qdrant
        if (this.qdrantService.isQdrantAvailable()) {
          try {
            await this.syncToQdrant(doc, embedding);
            qdrantSynced++;
          } catch (qdrantError) {
            this.logger.error(`Failed to sync to Qdrant: ${qdrantError.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to reindex document ${doc._id}: ${error.message}`);
        errors++;
      }
    }

    return { processed, errors, qdrantSynced };
  }

  /**
   * Run diagnostics on the knowledge base
   */
  async runDiagnostics(
    testQuery?: string,
    region?: string,
    language?: string,
  ): Promise<{
    totalDocuments: number;
    activeDocuments: number;
    documentsWithEmbeddings: number;
    documentsWithoutEmbeddings: { id: string; title: string }[];
    documentsByRegion: Record<string, number>;
    documentsByLanguage: Record<string, number>;
    documentsByCategory: Record<string, number>;
    qdrant: {
      available: boolean;
      count: number;
      info: any;
    };
    searchTest?: {
      query: string;
      resultsFound: number;
      results: { title: string; score: number; category: string; region: string; language: string }[];
    };
  }> {
    const allDocs = await this.knowledgeModel.find({});
    const activeDocs = allDocs.filter((d) => d.isActive);

    const docsWithEmbeddings = activeDocs.filter(
      (d) => d.embedding && d.embedding.length > 0,
    );
    const docsWithoutEmbeddings = activeDocs
      .filter((d) => !d.embedding || d.embedding.length === 0)
      .map((d) => ({ id: d._id.toString(), title: d.title }));

    const byRegion: Record<string, number> = {};
    activeDocs.forEach((d) => {
      byRegion[d.region] = (byRegion[d.region] || 0) + 1;
    });

    const byLanguage: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const lang = d.metadata?.language || 'unknown';
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    });

    const byCategory: Record<string, number> = {};
    activeDocs.forEach((d) => {
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    });

    // Qdrant stats
    let qdrantCount = 0;
    let qdrantInfo = null;
    if (this.qdrantService.isQdrantAvailable()) {
      qdrantCount = await this.qdrantService.getCount();
      qdrantInfo = await this.qdrantService.getCollectionInfo();
    }

    let searchTest;
    if (testQuery) {
      try {
        const results = await this.searchSimilar(testQuery, {
          region,
          language,
          limit: 10,
          minScore: 0.1,
        });

        searchTest = {
          query: testQuery,
          resultsFound: results.length,
          results: results.map((r) => ({
            title: r.document.title,
            score: Math.round(r.score * 1000) / 1000,
            category: r.document.category,
            region: r.document.region,
            language: r.document.metadata?.language || 'unknown',
          })),
        };
      } catch (error: any) {
        searchTest = {
          query: testQuery,
          resultsFound: 0,
          results: [],
          error: error.message,
        };
      }
    }

    return {
      totalDocuments: allDocs.length,
      activeDocuments: activeDocs.length,
      documentsWithEmbeddings: docsWithEmbeddings.length,
      documentsWithoutEmbeddings: docsWithoutEmbeddings,
      documentsByRegion: byRegion,
      documentsByLanguage: byLanguage,
      documentsByCategory: byCategory,
      qdrant: {
        available: this.qdrantService.isQdrantAvailable(),
        count: qdrantCount,
        info: qdrantInfo,
      },
      searchTest,
    };
  }

  /**
   * Add a document from a PDF file
   */
  async addDocumentFromPdf(
    file: Express.Multer.File,
    dto: UploadPdfDto,
  ): Promise<{ documentsCreated: number; title: string }> {
    try {
      const pdfData = await pdfParse(file.buffer);
      const text = pdfData.text;

      if (!text || text.trim().length === 0) {
        throw new Error('PDF file is empty or could not be parsed');
      }

      const title = dto.title || this.extractTitleFromPdf(pdfData, file.originalname);
      const chunks = this.embeddingsService.chunkText(text, 800, 100);

      this.logger.log(
        `Processing PDF "${title}" - extracted ${text.length} characters, split into ${chunks.length} chunks`,
      );

      let documentsCreated = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle =
          chunks.length > 1 ? `${title} (Part ${i + 1}/${chunks.length})` : title;

        const embedding = await this.embeddingsService.generateEmbedding(
          `${chunkTitle}\n\n${chunks[i]}`,
        );

        const document = new this.knowledgeModel({
          region: RegionType.US,
          category: dto.category as unknown as KnowledgeCategory,
          title: chunkTitle,
          content: chunks[i],
          embedding,
          metadata: {
            language: dto.language as unknown as LanguageType,
            lastUpdated: new Date(),
            version: 1,
            tags: [...(dto.tags || []), 'pdf-upload'],
            source: file.originalname,
          },
          isActive: true,
          chunkIndex: chunks.length > 1 ? i : undefined,
          parentDocumentId: chunks.length > 1 ? title : undefined,
        });

        const savedDoc = await document.save();

        // Sync to Qdrant
        await this.syncToQdrant(savedDoc, embedding);

        documentsCreated++;

        this.logger.log(
          `Created document chunk ${i + 1}/${chunks.length} for PDF "${title}"`,
        );
      }

      return { documentsCreated, title };
    } catch (error) {
      this.logger.error(`Failed to process PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract title from PDF metadata or first line of text
   */
  private extractTitleFromPdf(pdfData: any, originalFilename: string): string {
    if (pdfData.info?.Title && pdfData.info.Title.trim()) {
      return pdfData.info.Title.trim();
    }

    const lines = pdfData.text.split('\n').filter((line: string) => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length >= 5 && firstLine.length <= 150) {
        return firstLine;
      }
    }

    const filenameWithoutExt = originalFilename.replace(/\.pdf$/i, '');
    return filenameWithoutExt || 'Untitled Document';
  }

  /**
   * Add a document from a URL
   */
  async addDocumentFromUrl(
    dto: AddUrlDocumentDto,
  ): Promise<{ documentsCreated: number; title: string; urlSourceId: string }> {
    try {
      const existingSource = await this.urlSourceModel.findOne({ url: dto.url });
      if (existingSource) {
        throw new Error(
          `URL already exists in the knowledge base. Use refresh to update it.`,
        );
      }

      const extractedContent = await this.urlCrawlerService.extractContent(dto.url);
      const title = dto.title || extractedContent.title;
      const chunks = this.embeddingsService.chunkText(
        extractedContent.content,
        800,
        100,
      );

      this.logger.log(
        `Processing URL "${dto.url}" - extracted ${extractedContent.content.length} characters, split into ${chunks.length} chunks`,
      );

      const urlSource = new this.urlSourceModel({
        url: dto.url,
        title,
        category: dto.category,
        language: dto.language,
        tags: dto.tags || [],
        refreshIntervalHours: dto.refreshIntervalHours || null,
        lastCrawled: new Date(),
        nextCrawl: dto.refreshIntervalHours
          ? new Date(Date.now() + dto.refreshIntervalHours * 60 * 60 * 1000)
          : null,
        status: CrawlStatus.CRAWLING,
        documentIds: [],
        isActive: true,
      });

      const documentIds: Types.ObjectId[] = [];
      let documentsCreated = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle =
          chunks.length > 1 ? `${title} (Part ${i + 1}/${chunks.length})` : title;

        const embedding = await this.embeddingsService.generateEmbedding(
          `${chunkTitle}\n\n${chunks[i]}`,
        );

        const document = new this.knowledgeModel({
          region: RegionType.US,
          category: dto.category as unknown as KnowledgeCategory,
          title: chunkTitle,
          content: chunks[i],
          embedding,
          metadata: {
            language: dto.language as unknown as LanguageType,
            lastUpdated: new Date(),
            version: 1,
            tags: [...(dto.tags || []), 'url-crawl'],
            source: dto.url,
          },
          isActive: true,
          chunkIndex: chunks.length > 1 ? i : undefined,
          parentDocumentId: chunks.length > 1 ? title : undefined,
        });

        const savedDoc = await document.save();

        // Sync to Qdrant
        await this.syncToQdrant(savedDoc, embedding);

        documentIds.push(savedDoc._id as Types.ObjectId);
        documentsCreated++;

        this.logger.log(
          `Created document chunk ${i + 1}/${chunks.length} for URL "${dto.url}"`,
        );
      }

      urlSource.documentIds = documentIds;
      urlSource.chunksCount = documentsCreated;
      urlSource.status = CrawlStatus.SUCCESS;
      await urlSource.save();

      return {
        documentsCreated,
        title,
        urlSourceId: urlSource._id.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to process URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh content from a URL source
   */
  async refreshUrlSource(
    urlSourceId: string,
  ): Promise<{ documentsCreated: number; documentsDeleted: number; title: string }> {
    try {
      const urlSource = await this.urlSourceModel.findById(urlSourceId);
      if (!urlSource) {
        throw new Error('URL source not found');
      }

      urlSource.status = CrawlStatus.CRAWLING;
      urlSource.lastError = null;
      await urlSource.save();

      // Delete from Qdrant first
      if (this.qdrantService.isQdrantAvailable()) {
        for (const docId of urlSource.documentIds) {
          try {
            await this.qdrantService.delete(docId.toString());
          } catch (error) {
            this.logger.error(`Failed to delete from Qdrant: ${error.message}`);
          }
        }
      }

      const documentsDeleted = await this.knowledgeModel.deleteMany({
        _id: { $in: urlSource.documentIds },
      });

      const extractedContent = await this.urlCrawlerService.extractContent(
        urlSource.url,
      );

      const chunks = this.embeddingsService.chunkText(
        extractedContent.content,
        800,
        100,
      );

      const documentIds: Types.ObjectId[] = [];
      let documentsCreated = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle =
          chunks.length > 1
            ? `${urlSource.title} (Part ${i + 1}/${chunks.length})`
            : urlSource.title;

        const embedding = await this.embeddingsService.generateEmbedding(
          `${chunkTitle}\n\n${chunks[i]}`,
        );

        const document = new this.knowledgeModel({
          region: RegionType.US,
          category: urlSource.category,
          title: chunkTitle,
          content: chunks[i],
          embedding,
          metadata: {
            language: urlSource.language,
            lastUpdated: new Date(),
            version: 1,
            tags: [...(urlSource.tags || []), 'url-crawl'],
            source: urlSource.url,
          },
          isActive: true,
          chunkIndex: chunks.length > 1 ? i : undefined,
          parentDocumentId: chunks.length > 1 ? urlSource.title : undefined,
        });

        const savedDoc = await document.save();

        // Sync to Qdrant
        await this.syncToQdrant(savedDoc, embedding);

        documentIds.push(savedDoc._id as Types.ObjectId);
        documentsCreated++;
      }

      urlSource.documentIds = documentIds;
      urlSource.chunksCount = documentsCreated;
      urlSource.lastCrawled = new Date();
      urlSource.nextCrawl = urlSource.refreshIntervalHours
        ? new Date(Date.now() + urlSource.refreshIntervalHours * 60 * 60 * 1000)
        : null;
      urlSource.status = CrawlStatus.SUCCESS;
      await urlSource.save();

      this.logger.log(
        `Refreshed URL "${urlSource.url}" - deleted ${documentsDeleted.deletedCount}, created ${documentsCreated} documents`,
      );

      return {
        documentsCreated,
        documentsDeleted: documentsDeleted.deletedCount,
        title: urlSource.title,
      };
    } catch (error) {
      await this.urlSourceModel.findByIdAndUpdate(urlSourceId, {
        status: CrawlStatus.FAILED,
        lastError: error.message,
      });
      this.logger.error(`Failed to refresh URL source: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a URL source and all its documents
   */
  async deleteUrlSource(urlSourceId: string): Promise<{ documentsDeleted: number }> {
    const urlSource = await this.urlSourceModel.findById(urlSourceId);
    if (!urlSource) {
      throw new Error('URL source not found');
    }

    // Delete from Qdrant first
    if (this.qdrantService.isQdrantAvailable()) {
      for (const docId of urlSource.documentIds) {
        try {
          await this.qdrantService.delete(docId.toString());
        } catch (error) {
          this.logger.error(`Failed to delete from Qdrant: ${error.message}`);
        }
      }
    }

    const result = await this.knowledgeModel.deleteMany({
      _id: { $in: urlSource.documentIds },
    });

    await this.urlSourceModel.deleteOne({ _id: urlSourceId });

    this.logger.log(
      `Deleted URL source "${urlSource.url}" and ${result.deletedCount} documents`,
    );

    return { documentsDeleted: result.deletedCount };
  }

  /**
   * Get all URL sources
   */
  async getAllUrlSources(): Promise<UrlSourceDocument[]> {
    return this.urlSourceModel.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * Get URL sources that need to be refreshed
   */
  async getUrlSourcesDueForRefresh(): Promise<UrlSourceDocument[]> {
    return this.urlSourceModel.find({
      isActive: true,
      refreshIntervalHours: { $ne: null },
      nextCrawl: { $lte: new Date() },
      status: { $ne: CrawlStatus.CRAWLING },
    });
  }

  /**
   * Update a URL source configuration
   */
  async updateUrlSource(
    urlSourceId: string,
    updates: {
      title?: string;
      category?: string;
      language?: string;
      tags?: string[];
      refreshIntervalHours?: number | null;
      isActive?: boolean;
    },
  ): Promise<UrlSourceDocument | null> {
    const urlSource = await this.urlSourceModel.findById(urlSourceId);
    if (!urlSource) {
      return null;
    }

    if (updates.title !== undefined) urlSource.title = updates.title;
    if (updates.category !== undefined) urlSource.category = updates.category as KnowledgeCategory;
    if (updates.language !== undefined) urlSource.language = updates.language as LanguageType;
    if (updates.tags !== undefined) urlSource.tags = updates.tags;
    if (updates.refreshIntervalHours !== undefined) {
      urlSource.refreshIntervalHours = updates.refreshIntervalHours;
      urlSource.nextCrawl = updates.refreshIntervalHours
        ? new Date(Date.now() + updates.refreshIntervalHours * 60 * 60 * 1000)
        : null;
    }
    if (updates.isActive !== undefined) urlSource.isActive = updates.isActive;

    return urlSource.save();
  }

  /**
   * Migrate all existing MongoDB documents to Qdrant
   */
  async migrateToQdrant(): Promise<{
    total: number;
    migrated: number;
    errors: number;
    skipped: number;
  }> {
    if (!this.qdrantService.isQdrantAvailable()) {
      throw new Error('Qdrant is not available. Check QDRANT_URL and QDRANT_API_KEY environment variables.');
    }

    const documents = await this.knowledgeModel.find({ isActive: true });
    let migrated = 0;
    let errors = 0;
    let skipped = 0;

    this.logger.log(`Starting migration of ${documents.length} documents to Qdrant...`);

    for (const doc of documents) {
      if (!doc.embedding || doc.embedding.length === 0) {
        this.logger.warn(`Skipping document ${doc._id} - no embedding`);
        skipped++;
        continue;
      }

      try {
        await this.syncToQdrant(doc, doc.embedding);
        migrated++;

        if (migrated % 10 === 0) {
          this.logger.log(`Migrated ${migrated}/${documents.length} documents...`);
        }
      } catch (error) {
        this.logger.error(`Failed to migrate document ${doc._id}: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`Migration complete: ${migrated} migrated, ${errors} errors, ${skipped} skipped`);

    return {
      total: documents.length,
      migrated,
      errors,
      skipped,
    };
  }
}
