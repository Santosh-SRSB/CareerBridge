import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ResumeContent } from '@careerbridge/shared';
import { GeminiProvider } from './providers/gemini.provider';
import { AiGatewayService } from './ai-gateway.service';
import { VectorStoreService } from './vector-store.service';
import { CHUNKING_POLICY } from './chunking/chunking-policy';
import {
  chunkJobDescription,
  chunkResumeContent,
  type JobChunkInput,
  type SemanticChunk,
} from './chunking/resume-chunking';

@Injectable()
export class DocumentIndexService {
  private readonly logger = new Logger(DocumentIndexService.name);

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly gateway: AiGatewayService,
    private readonly vectors: VectorStoreService,
  ) {}

  async indexResume(input: {
    resumeId: string;
    candidateId: string;
    content: ResumeContent;
    userId?: string;
    city?: string | null;
    about?: string | null;
    skills?: string[];
    experienceSummary?: string | null;
  }): Promise<{
    ok: boolean;
    unavailable?: boolean;
    chunkCount: number;
    embedded?: number;
    reused?: number;
    error?: string;
  }> {
    const started = Date.now();
    const chunks = hashChunks(chunkResumeContent(input.content));
    try {
      const profile = await this.gateway.upsertEmbedding({
        entityType: 'CANDIDATE',
        entityId: input.candidateId,
        text: this.gateway.buildCandidateEmbedText({
          city: input.city || input.content.city,
          skills: input.skills || input.content.skills || [],
          about: input.about || input.content.summary,
          experienceSummary: input.experienceSummary,
        }),
        userId: input.userId,
      });
      if (!profile.ok && this.gemini.isConfigured()) {
        return { ok: false, chunkCount: 0, error: 'Candidate profile embedding failed' };
      }

      if (!chunks.length) {
        return { ok: false, chunkCount: 0, error: 'Resume has no indexable content' };
      }
      const model = this.gemini.getEmbeddingModel();
      const reusable = new Map<string, number[]>();
      for (const row of await this.vectors.getActiveResumeChunks(input.resumeId, true)) {
        if (row.contentHash && row.values?.length && row.model === model) reusable.set(row.contentHash, row.values);
      }
      const toEmbed = chunks.filter((chunk) => !reusable.has(chunk.metadata.contentHash as string));
      const embedded = toEmbed.length
        ? await this.gemini.embedMany(toEmbed.map((chunk) => chunk.content))
        : { vectors: [] as number[][], model, requests: 0 };
      const fresh = new Map(toEmbed.map((chunk, index) => [chunk.metadata.contentHash as string, embedded.vectors[index]]));
      await this.vectors.replaceResumeChunks({
        resumeId: input.resumeId,
        candidateId: input.candidateId,
        model: embedded.model,
        chunks: chunks.map((chunk) => {
          const hash = chunk.metadata.contentHash as string;
          return { ...chunk, values: fresh.get(hash) || (reusable.get(hash) as number[]) };
        }),
      });
      this.logger.log(
        JSON.stringify({
          msg: 'resume_indexed',
          resumeId: input.resumeId,
          chunks: chunks.length,
          embedded: toEmbed.length,
          reused: chunks.length - toEmbed.length,
          embedRequests: embedded.requests,
          chunkingVersion: CHUNKING_POLICY.version,
          ms: Date.now() - started,
        }),
      );
      return { ok: true, chunkCount: chunks.length, embedded: toEmbed.length, reused: chunks.length - toEmbed.length };
    } catch (err) {
      if (this.vectors.isUnavailable(err)) {
        this.vectors.logUnavailable(err);
        return {
          ok: false,
          chunkCount: chunks.length,
          error:
            'pgvector is not available. Install the PostgreSQL vector extension and apply the RAG migration, then reprocess the resume.',
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Resume index failed for ${input.resumeId}: ${message.slice(0, 240)}`);
      return { ok: false, chunkCount: chunks.length, error: message.slice(0, 500) };
    }
  }

  /**
   * True when the active chunks match what the current chunker and embedding model would produce for this
   * content. A new chunking version, model, or edited resume content makes the index stale.
   */
  async isResumeIndexCurrent(resumeId: string, content: ResumeContent): Promise<boolean> {
    try {
      const stored = await this.vectors.getActiveResumeChunks(resumeId);
      if (!stored.length) return false;
      const model = this.gemini.getEmbeddingModel();
      if (stored.some((row) => row.model !== model || row.chunkingVersion !== CHUNKING_POLICY.version)) return false;
      const expected = hashChunks(chunkResumeContent(content)).map((chunk) => chunk.metadata.contentHash);
      return (
        expected.length === stored.length && expected.every((hash, index) => hash === stored[index].contentHash)
      );
    } catch (err) {
      if (this.vectors.isUnavailable(err)) this.vectors.logUnavailable(err);
      else this.logger.warn(`Resume index lookup failed for ${resumeId}: ${(err as Error).message.slice(0, 240)}`);
      return false;
    }
  }

  async indexJob(job: JobChunkInput & { id: string }): Promise<{ ok: boolean; chunkCount: number }> {
    const chunks = chunkJobDescription(job);
    const sourceHash = createHash('sha256')
      .update(chunks.map((chunk) => chunk.content).join('\n---\n'))
      .digest('hex')
      .slice(0, 40);
    try {
      const current = await this.vectors.storedJobSourceHash(job.id);
      if (current === sourceHash) return { ok: true, chunkCount: chunks.length };
      const profile = await this.gateway.upsertEmbedding({
        entityType: 'JOB',
        entityId: job.id,
        text: this.gateway.buildJobEmbedText({
          title: job.title,
          description: job.description,
          city: job.city || undefined,
          category: job.category || undefined,
          requiredSkills: job.requiredSkills,
          experience: job.experience,
        }),
      });
      if (!profile.ok) return { ok: false, chunkCount: 0 };
      const embedded = await this.embedChunks(chunks.map((chunk) => chunk.content));
      await this.vectors.replaceJobChunks({
        jobId: job.id,
        model: embedded.model,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          metadata: { ...chunk.metadata, sourceHash },
          values: embedded.vectors[index],
        })),
      });
      this.logger.log(`Indexed job ${job.id}: chunks=${chunks.length} version=${CHUNKING_POLICY.version}`);
      return { ok: true, chunkCount: chunks.length };
    } catch (err) {
      if (this.vectors.isUnavailable(err)) {
        this.vectors.logUnavailable(err);
        return { ok: false, chunkCount: 0 };
      }
      this.logger.warn(`Job index failed for ${job.id}: ${(err as Error).message.slice(0, 240)}`);
      return { ok: false, chunkCount: chunks.length };
    }
  }

  private async embedChunks(texts: string[]): Promise<{ model: string; vectors: number[][] }> {
    const { vectors, model } = await this.gemini.embedMany(texts);
    return { model, vectors };
  }
}

function hashChunks<T extends SemanticChunk>(chunks: T[]): T[] {
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      contentHash: createHash('sha256').update(`${chunk.section}\n${chunk.content}`).digest('hex').slice(0, 40),
    },
  }));
}
