import { Injectable, Logger } from '@nestjs/common';
import { VectorStoreService } from '../embeddings/vector-store.service';
import { knowledgeBaseSeedData } from './knowledge-base.seed';
import {
  KnowledgeCategory,
  RegionType,
  LanguageType,
} from '../schemas/knowledge-document.schema';

export interface SeedResult {
  success: boolean;
  totalDocuments: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class KnowledgeBaseSeedService {
  private readonly logger = new Logger(KnowledgeBaseSeedService.name);

  constructor(private readonly vectorStore: VectorStoreService) {}

  /**
   * Seed the knowledge base with all FAQ content
   */
  async seedAll(): Promise<SeedResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    this.logger.log('Starting knowledge base seeding...');
    this.logger.log(`Total documents to seed: ${knowledgeBaseSeedData.length}`);

    for (const doc of knowledgeBaseSeedData) {
      try {
        this.logger.log(`Seeding: "${doc.title}" (${doc.language})`);

        await this.vectorStore.addDocument(doc.title, doc.content, {
          region: doc.region as RegionType,
          category: doc.category as KnowledgeCategory,
          language: doc.language as LanguageType,
          tags: doc.tags,
        });

        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to seed "${doc.title}": ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }

      // Small delay to avoid rate limiting
      await this.delay(300);
    }

    const duration = Date.now() - startTime;

    this.logger.log(`Seeding complete! Success: ${successCount}, Failed: ${errorCount}`);

    return {
      success: errorCount === 0,
      totalDocuments: knowledgeBaseSeedData.length,
      successCount,
      errorCount,
      errors,
      duration,
    };
  }

  /**
   * Seed only documents for a specific language
   */
  async seedByLanguage(language: 'en' | 'es'): Promise<SeedResult> {
    const filteredDocs = knowledgeBaseSeedData.filter(
      (doc) => doc.language === language,
    );

    const startTime = Date.now();
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    this.logger.log(`Seeding ${language} documents: ${filteredDocs.length}`);

    for (const doc of filteredDocs) {
      try {
        await this.vectorStore.addDocument(doc.title, doc.content, {
          region: doc.region as RegionType,
          category: doc.category as KnowledgeCategory,
          language: doc.language as LanguageType,
          tags: doc.tags,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed: "${doc.title}": ${error.message}`);
      }
      await this.delay(300);
    }

    return {
      success: errorCount === 0,
      totalDocuments: filteredDocs.length,
      successCount,
      errorCount,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Seed only documents for a specific category
   */
  async seedByCategory(
    category: 'faq' | 'academy' | 'mentorship' | 'navigation' | 'pricing' | 'general',
  ): Promise<SeedResult> {
    const filteredDocs = knowledgeBaseSeedData.filter(
      (doc) => doc.category === category,
    );

    const startTime = Date.now();
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    this.logger.log(`Seeding ${category} documents: ${filteredDocs.length}`);

    for (const doc of filteredDocs) {
      try {
        await this.vectorStore.addDocument(doc.title, doc.content, {
          region: doc.region as RegionType,
          category: doc.category as KnowledgeCategory,
          language: doc.language as LanguageType,
          tags: doc.tags,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed: "${doc.title}": ${error.message}`);
      }
      await this.delay(300);
    }

    return {
      success: errorCount === 0,
      totalDocuments: filteredDocs.length,
      successCount,
      errorCount,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check how many documents are currently in the knowledge base
   */
  async getStats(): Promise<{
    totalInSeed: number;
    byLanguage: { en: number; es: number };
    byCategory: Record<string, number>;
  }> {
    const byLanguage = {
      en: knowledgeBaseSeedData.filter((d) => d.language === 'en').length,
      es: knowledgeBaseSeedData.filter((d) => d.language === 'es').length,
    };

    const byCategory: Record<string, number> = {};
    for (const doc of knowledgeBaseSeedData) {
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    }

    return {
      totalInSeed: knowledgeBaseSeedData.length,
      byLanguage,
      byCategory,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
