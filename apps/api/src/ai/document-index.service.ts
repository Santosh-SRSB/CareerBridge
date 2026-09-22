import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ResumeContent } from '@careerbridge/shared';
import { GeminiProvider } from './providers/gemini.provider';
import { AiGatewayService } from './ai-gateway.service';
import { VectorStoreService } from './vector-store.service';
import { CHUNKING_POLICY } from './chunking/chunking-policy';
import { chunkJobDescription, chunkResumeContent, type JobChunkInput } from './chunking/resume-chunking';

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
  }): Promise<{ ok: boolean; unavailable?: boolean; chunkCount: number; error?: string }> {
    const started = Date.now();
    const chunks = chunkResumeContent(input.content);
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

      const embedded = await this.embedChunks(chunks.map((chunk) => chunk.content));
      await this.vectors.replaceResumeChunks({
        resumeId: input.resumeId,
        candidateId: input.candidateId,
        model: embedded.model,
        chunks: chunks.map((chunk, index) => ({ ...chunk, values: embedded.vectors[index] })),
      });
      this.logger.log(
        `Indexed resume ${input.resumeId}: chunks=${chunks.length} tokens=${chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)} version=${CHUNKING_POLICY.version} ms=${Date.now() - started}`,
      );
      return { ok: true, chunkCount: chunks.length };
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
    const vectors: number[][] = [];
    let model = this.gemini.getEmbeddingModel();
    for (const text of texts) {
      const embedded = await this.gemini.embed(text);
      if (!embedded.values.length) {
        throw new Error('Embedding provider returned an empty vector');
      }
      model = embedded.model;
      vectors.push(embedded.values);
    }
    return { model, vectors };
  }
}
