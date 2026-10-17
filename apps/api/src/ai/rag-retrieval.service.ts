import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { VectorStoreService, type StoredChunkHit } from './vector-store.service';

/**
 * Chosen from the DEV evaluation (gemini-embedding-001 @768, v2 chunks): 0.58 is the lowest threshold at which
 * none of the clearly unrelated queries returned a chunk while 12/14 relevant queries still did.
 */
export const DEFAULT_RAG_MIN_SCORE = 0.58;
/**
 * Section-scoped requests ("ask about their education") are already topical through the section filter; this
 * floor only drops low-value chunks inside that section (junk education text scored 0.42-0.43, real roles 0.53+).
 */
export const DEFAULT_RAG_SECTION_MIN_SCORE = 0.5;

@Injectable()
export class RagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly vectors: VectorStoreService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  minScore(sectionScoped = false): number {
    const key = sectionScoped ? 'RAG_SECTION_MIN_SCORE' : 'RAG_MIN_SCORE';
    const fallback = sectionScoped ? DEFAULT_RAG_SECTION_MIN_SCORE : DEFAULT_RAG_MIN_SCORE;
    const value = Number(this.config?.get<string>(key));
    return Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
  }

  /**
   * Passage retrieval for one owner. candidateId or jobId is required so chunks
   * cannot be searched across private resumes.
   */
  async retrieve(input: {
    query: string;
    candidateId?: string;
    resumeId?: string;
    jobId?: string;
    sections?: string[] | null;
    limit?: number;
    minScore?: number;
  }): Promise<StoredChunkHit[]> {
    if (!input.candidateId && !input.jobId) return [];
    if (input.resumeId && !input.candidateId) return [];
    if (!this.gemini.isConfigured()) return [];
    const query = input.query.trim().slice(0, 4000);
    if (!query) return [];
    try {
      const embedded = await this.gemini.embed(query);
      if (!embedded.values.length) return [];
      return await this.vectors.searchChunks({
        vector: embedded.values,
        candidateId: input.candidateId,
        resumeId: input.resumeId,
        jobId: input.jobId,
        sections: input.sections,
        limit: Math.min(Math.max(input.limit ?? 5, 1), 20),
        minScore: input.minScore ?? this.minScore(Boolean(input.sections?.length)),
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
