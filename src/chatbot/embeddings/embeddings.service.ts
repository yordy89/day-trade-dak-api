import { Inject, Injectable, Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly embeddingModel = 'text-embedding-3-small';
  private readonly embeddingDimensions = 1536;

  constructor(
    @Inject('OPEN_AI_AXIOS') private readonly axios: AxiosInstance,
  ) {}

  /**
   * Generate embedding vector for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const cleanedText = this.cleanText(text);

      const { data } = await this.axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.embeddingModel,
          input: cleanedText,
          dimensions: this.embeddingDimensions,
        },
      );

      return data.data[0].embedding;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in a single API call
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const cleanedTexts = texts.map((text) => this.cleanText(text));

      const { data } = await this.axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.embeddingModel,
          input: cleanedTexts,
          dimensions: this.embeddingDimensions,
        },
      );

      // Sort by index to maintain order
      const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
      return sortedData.map((item: any) => item.embedding);
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  chunkText(
    text: string,
    maxTokens: number = 500,
    overlap: number = 50,
  ): string[] {
    const chunks: string[] = [];

    // Simple sentence-based chunking
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let currentTokenCount = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokenCount + sentenceTokens > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // Start new chunk with overlap from previous
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + sentence;
        currentTokenCount = this.estimateTokens(currentChunk);
      } else {
        currentChunk += ' ' + sentence;
        currentTokenCount += sentenceTokens;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Clean text before embedding
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
      .trim()
      .slice(0, 8000); // Limit text length
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(' ');
    const overlapWords = Math.ceil(overlapTokens / 2); // Rough conversion
    return words.slice(-overlapWords).join(' ') + ' ';
  }

  /**
   * Get the embedding dimensions
   */
  getEmbeddingDimensions(): number {
    return this.embeddingDimensions;
  }
}
