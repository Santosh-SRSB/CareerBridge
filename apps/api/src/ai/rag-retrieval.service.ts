import { Injectable, Logger } from '@nestjs/common';
import type { ResumeContent } from '@careerbridge/shared';
import { GeminiProvider } from './providers/gemini.provider';
import { VectorStoreService, type StoredChunkHit } from './vector-store.service';

@Injectable()
export class RagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly vectors: VectorStoreService,
  ) {}

  /**
   * Passage retrieval for one owner. candidateId or jobId is required so chunks
   * cannot be searched across private resumes.
   */
  async retrieve(input: {
    query: string;
    candidateId?: string;
    jobId?: string;
    limit?: number;
    minScore?: number;
  }): Promise<StoredChunkHit[]> {
    if (!input.candidateId && !input.jobId) return [];
    if (!this.gemini.isConfigured()) return [];
    const query = input.query.trim().slice(0, 4000);
    if (!query) return [];
    try {
      const embedded = await this.gemini.embed(query);
      if (!embedded.values.length) return [];
      return await this.vectors.searchChunks({
        vector: embedded.values,
        candidateId: input.candidateId,
        jobId: input.jobId,
        limit: input.limit ?? 5,
        minScore: input.minScore ?? 0.35,
      });
    } catch (err) {
      if (this.vectors.isUnavailable(err)) {
        this.vectors.logUnavailable(err);
        return [];
      }
      this.logger.warn(`Chunk retrieval failed: ${(err as Error).message}`);
      return [];
    }
  }
}
