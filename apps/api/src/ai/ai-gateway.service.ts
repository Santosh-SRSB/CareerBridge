import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiProvider } from './providers/gemini.provider';
import {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderName,
  AiRequestOptions,
  EmbeddingEntityType,
  StructuredResumeDraft,
} from './ai.types';
import { getPrompt } from './prompts/prompt-registry';
import {
  InterviewEvaluationResult,
  JobMatchResult,
  ResumeReviewResult,
  ResumeRewriteResult,
} from './schemas/ai-response.schemas';
import { cosineSimilarity, parseEmbeddingJson } from './utils/vector.util';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiProvider,
  ) {}

  /**
   * Gemini-only resolution (Volume 2 ADR-005). No OpenAI fallback.
   */
  private resolveProvider(requested?: AiProviderName) {
    if (requested && requested !== 'gemini') return null;
    return this.gemini.isConfigured() ? this.gemini : null;
  }

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  getActiveProviderName(): AiProviderName {
    return this.gemini.isConfigured() ? 'gemini' : 'fallback';
  }

  private estimateCost(
    provider: AiProviderName,
    _model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    if (provider === 'gemini') {
      return (inputTokens * 0.075 + outputTokens * 0.3) / 1_000_000;
    }
    return 0;
  }

  async generate<T>(request: AiGenerateRequest): Promise<AiGenerateResponse<T>> {
    const startTime = Date.now();
    const promptVersion = request.options?.promptVersion || `${request.task.toLowerCase()}.v1`;
    const provider = this.resolveProvider(request.options?.provider);

    if (!provider) {
      this.logger.warn(`No Gemini provider configured for task "${request.task}".`);
      return {
        success: false,
        data: null,
        provider: 'fallback',
        model: 'none',
        promptVersion,
        latencyMs: Date.now() - startTime,
        error: 'No AI provider configured (set GEMINI_API_KEY)',
      };
    }

    try {
      const result = await provider.generateStructured<T>(
        request.systemPrompt,
        request.userPrompt,
        {
          model: request.options?.model,
          temperature: request.options?.temperature,
          maxOutputTokens: request.options?.maxOutputTokens,
        },
      );

      const latencyMs = Date.now() - startTime;
      const estimatedCostUsd = this.estimateCost(
        provider.name,
        result.model,
        result.inputTokens,
        result.outputTokens,
      );

      this.logger.log(
        JSON.stringify({
          event: 'AI_INTERACTION',
          task: request.task,
          provider: provider.name,
          model: result.model,
          promptVersion,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          estimatedCostUsd,
          success: Boolean(result.data),
          userId: request.options?.userId,
          requestId: request.options?.requestId,
        }),
      );

      try {
        await this.prisma.aiInteraction.create({
          data: {
            userId: request.options?.userId || null,
            operation: request.task,
            provider: provider.name,
            model: result.model,
            promptVersion,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs,
            status: result.data ? 'SUCCESS' : 'FAILED',
            estimatedCostUsd,
            requestId: request.options?.requestId || null,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to persist AI interaction: ${(err as Error).message}`);
      }

      return {
        success: Boolean(result.data),
        data: result.data,
        rawText: result.rawText,
        provider: provider.name,
        model: result.model,
        promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        estimatedCostUsd,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = (err as Error).message;
      this.logger.error(`AI Gateway execution failed for ${request.task}: ${errorMsg}`);

      try {
        await this.prisma.aiInteraction.create({
          data: {
            userId: request.options?.userId || null,
            operation: request.task,
            provider: 'gemini',
            model: 'unknown',
            promptVersion,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs,
            status: 'FAILED',
            estimatedCostUsd: 0,
            requestId: request.options?.requestId || null,
            error: errorMsg.slice(0, 2000),
          },
        });
      } catch {
        /* ignore telemetry errors */
      }

      return {
        success: false,
        data: null,
        provider: 'gemini',
        model: 'unknown',
        promptVersion,
        latencyMs,
        error: errorMsg,
      };
    }
  }

  /**
   * Create or refresh an embedding via Gemini only. Stored as JSON vector in Postgres.
   */
  async upsertEmbedding(input: {
    entityType: EmbeddingEntityType;
    entityId: string;
    text: string;
    userId?: string;
  }): Promise<{ ok: boolean; dimensions: number; reused: boolean }> {
    const text = input.text.trim().slice(0, 8000);
    if (!text || !this.gemini.isConfigured()) {
      return { ok: false, dimensions: 0, reused: false };
    }

    const contentHash = createHash('sha256').update(text).digest('hex').slice(0, 40);
    const existing = await this.prisma.embedding.findUnique({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
    });
    if (existing && existing.contentHash === contentHash) {
      return { ok: true, dimensions: existing.dimensions, reused: true };
    }

    const start = Date.now();
    try {
      const embedded = await this.gemini.embed(text);
      if (!embedded.values.length) {
        return { ok: false, dimensions: 0, reused: false };
      }

      await this.prisma.embedding.upsert({
        where: {
          entityType_entityId: {
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        create: {
          entityType: input.entityType,
          entityId: input.entityId,
          contentHash,
          embeddingJson: JSON.stringify(embedded.values),
          model: embedded.model,
          dimensions: embedded.values.length,
        },
        update: {
          contentHash,
          embeddingJson: JSON.stringify(embedded.values),
          model: embedded.model,
          dimensions: embedded.values.length,
        },
      });

      try {
        await this.prisma.aiInteraction.create({
          data: {
            userId: input.userId || null,
            operation: 'EMBEDDING',
            provider: 'gemini',
            model: embedded.model,
            promptVersion: 'embed.v1',
            inputTokens: Math.ceil(text.length / 4),
            outputTokens: 0,
            latencyMs: Date.now() - start,
            status: 'SUCCESS',
            estimatedCostUsd: 0,
          },
        });
      } catch {
        /* ignore */
      }

      return { ok: true, dimensions: embedded.values.length, reused: false };
    } catch (err) {
      this.logger.warn(`Embedding failed for ${input.entityType}/${input.entityId}: ${(err as Error).message}`);
      return { ok: false, dimensions: 0, reused: false };
    }
  }

  async getEmbeddingVector(entityType: EmbeddingEntityType, entityId: string): Promise<number[] | null> {
    const row = await this.prisma.embedding.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    if (!row) return null;
    const values = parseEmbeddingJson(row.embeddingJson);
    return values.length ? values : null;
  }

  /**
   * RAG-style retrieval: embed the query, rank stored embeddings by cosine similarity.
   */
  async retrieveSimilar(input: {
    query: string;
    entityTypes?: EmbeddingEntityType[];
    limit?: number;
    minScore?: number;
  }): Promise<Array<{ entityType: string; entityId: string; score: number }>> {
    if (!this.gemini.isConfigured()) return [];
    const query = input.query.trim().slice(0, 4000);
    if (!query) return [];

    try {
      const embedded = await this.gemini.embed(query);
      if (!embedded.values.length) return [];

      const rows = await this.prisma.embedding.findMany({
        where: input.entityTypes?.length
          ? { entityType: { in: input.entityTypes } }
          : undefined,
        take: 500,
      });

      const minScore = input.minScore ?? 0.35;
      const limit = input.limit ?? 5;
      return rows
        .map((row) => ({
          entityType: row.entityType,
          entityId: row.entityId,
          score: cosineSimilarity(embedded.values, parseEmbeddingJson(row.embeddingJson)),
        }))
        .filter((row) => row.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (err) {
      this.logger.warn(`RAG retrieve failed: ${(err as Error).message}`);
      return [];
    }
  }

  async similarityScore(
    left: { entityType: EmbeddingEntityType; entityId: string },
    right: { entityType: EmbeddingEntityType; entityId: string },
  ): Promise<number> {
    const [a, b] = await Promise.all([
      this.getEmbeddingVector(left.entityType, left.entityId),
      this.getEmbeddingVector(right.entityType, right.entityId),
    ]);
    if (!a || !b) return 0;
    return cosineSimilarity(a, b);
  }

  async structureResumeText(
    rawText: string,
    options?: AiRequestOptions,
  ): Promise<StructuredResumeDraft | null> {
    const prompt = getPrompt('resume-structure.v1');
    const res = await this.generate<StructuredResumeDraft>({
      task: 'RESUME_STRUCTURE',
      systemPrompt: prompt.system,
      userPrompt: `Resume text:\n${rawText.slice(0, 14000)}`,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: 0,
      },
    });
    return res.data;
  }

  async rewriteResume(
    content: unknown,
    issues: unknown[],
    facts: unknown[],
    options?: AiRequestOptions,
  ): Promise<ResumeRewriteResult | null> {
    const prompt = getPrompt('resume-rewrite.v1');
    const userPayload = JSON.stringify({ content, facts, issues });
    const res = await this.generate<ResumeRewriteResult>({
      task: 'RESUME_REWRITE',
      systemPrompt: prompt.system,
      userPrompt: userPayload,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: 0.1,
      },
    });
    return res.data;
  }

  async reviewResume(
    content: unknown,
    targetRole?: string,
    options?: AiRequestOptions,
  ): Promise<ResumeReviewResult | null> {
    const prompt = getPrompt('resume-review.v1');
    await this.ensureBaselineKnowledge().catch(() => undefined);
    const query = `${targetRole || ''} ${JSON.stringify(content)}`.slice(0, 2000);
    const ragHits = await this.retrieveSimilar({
      query,
      entityTypes: ['KNOWLEDGE', 'JOB'],
      limit: 4,
      minScore: 0.4,
    });
    const userPayload = JSON.stringify({
      content,
      targetRole,
      retrievedContext: ragHits,
    });
    const res = await this.generate<ResumeReviewResult>({
      task: 'RESUME_REVIEW',
      systemPrompt: prompt.system,
      userPrompt: userPayload,
      options: {
        ...options,
        promptVersion: prompt.version,
      },
    });
    return res.data;
  }

  /**
   * Seed a small RAG knowledge base once (roles / skills guidance). Idempotent via content hash.
   */
  async ensureBaselineKnowledge(): Promise<void> {
    if (!this.gemini.isConfigured()) return;
    const docs: Array<{ id: string; text: string }> = [
      {
        id: 'knowledge-customer-service',
        text: 'Customer Service roles value communication, empathy, CRM tools, complaint handling, telephone etiquette, and measurable service outcomes.',
      },
      {
        id: 'knowledge-resume-ats',
        text: 'ATS-friendly resumes use clear section headings, plain text skills, quantified achievements, and avoid tables or graphics for core content.',
      },
      {
        id: 'knowledge-fresher-guidance',
        text: 'Fresher candidates should emphasize education, projects, internships, transferable skills, and readiness to learn rather than inventing work experience.',
      },
      {
        id: 'knowledge-interview-basics',
        text: 'Strong interview answers are structured, relevant, specific, and honest. Prefer STAR-style examples from real experience.',
      },
    ];
    for (const doc of docs) {
      await this.upsertEmbedding({
        entityType: 'KNOWLEDGE',
        entityId: doc.id,
        text: doc.text,
      });
    }
  }

  async evaluateInterviewAnswer(
    profile: unknown,
    question: string,
    answer: string,
    options?: AiRequestOptions,
  ): Promise<InterviewEvaluationResult | null> {
    const prompt = getPrompt('interview-evaluation.v1');
    const userPayload = JSON.stringify({ profile, question, answer });
    const res = await this.generate<InterviewEvaluationResult>({
      task: 'INTERVIEW_EVALUATION',
      systemPrompt: prompt.system,
      userPrompt: userPayload,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: 0.2,
      },
    });
    return res.data;
  }

  async matchJob(
    candidate: unknown,
    job: unknown,
    options?: AiRequestOptions,
  ): Promise<JobMatchResult | null> {
    const prompt = getPrompt('job-matching.v1');
    const userPayload = JSON.stringify({ candidate, job });
    const res = await this.generate<JobMatchResult>({
      task: 'JOB_MATCHING',
      systemPrompt: prompt.system,
      userPrompt: userPayload,
      options: {
        ...options,
        promptVersion: prompt.version,
      },
    });
    return res.data;
  }

  /**
   * Build a short text document used for candidate / job / resume embeddings.
   */
  buildCandidateEmbedText(input: {
    city?: string | null;
    skills?: string[];
    careerInterests?: string[];
    about?: string | null;
    experienceSummary?: string | null;
  }): string {
    return [
      input.about || '',
      `City: ${input.city || ''}`,
      `Skills: ${(input.skills || []).join(', ')}`,
      `Interests: ${(input.careerInterests || []).join(', ')}`,
      input.experienceSummary || '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 6000);
  }

  buildJobEmbedText(input: {
    title: string;
    description: string;
    city?: string;
    category?: string;
    requiredSkills?: string[];
    experience?: string | null;
  }): string {
    return [
      input.title,
      input.category || '',
      input.city || '',
      input.experience || '',
      `Required skills: ${(input.requiredSkills || []).join(', ')}`,
      input.description,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 6000);
  }
}
