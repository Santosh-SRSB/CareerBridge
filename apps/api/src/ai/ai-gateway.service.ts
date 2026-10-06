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
import { cosineSimilarity } from './utils/vector.util';
import { VectorStoreService } from './vector-store.service';
import {
  AI_SETTING_DEFAULTS,
  type AiLimits,
  type AiUnavailableReason,
  aiUsageDayStart,
  evaluateAiBudget,
  parseAiSettings,
} from '@careerbridge/shared';
import { AiCircuitBreaker, classifyAiError, unavailableReasonFor } from './ai-resilience';

const SETTINGS_TTL_MS = 30_000;
const USAGE_TTL_MS = 60_000;

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly breaker: AiCircuitBreaker;
  private limitsCache: { value: AiLimits; fetchedAt: number } | null = null;
  private usageCache: { dayStart: number; requests: number; tokens: number; fetchedAt: number } | null = null;
  private lastLimitAlert: { dayStart: number; reason: AiUnavailableReason } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiProvider,
    private readonly vectors: VectorStoreService,
  ) {
    const cooldown = Number(this.config.get<string>('AI_UNAVAILABLE_COOLDOWN_MS') || 60_000);
    this.breaker = new AiCircuitBreaker(Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : 60_000);
  }

  private async loadLimits(): Promise<AiLimits> {
    if (this.limitsCache && Date.now() - this.limitsCache.fetchedAt < SETTINGS_TTL_MS) {
      return this.limitsCache.value;
    }
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { key: { in: Object.keys(AI_SETTING_DEFAULTS) } },
      });
      const value = parseAiSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
      this.limitsCache = { value, fetchedAt: Date.now() };
      return value;
    } catch (err) {
      this.logger.warn(`AI settings read failed, keeping last known limits: ${(err as Error).message}`);
      return this.limitsCache?.value ?? parseAiSettings({});
    }
  }

  private async loadUsageToday(): Promise<{ requests: number; tokens: number }> {
    const dayStart = aiUsageDayStart().getTime();
    const cached = this.usageCache;
    if (cached && cached.dayStart === dayStart && Date.now() - cached.fetchedAt < USAGE_TTL_MS) {
      return cached;
    }
    try {
      const agg = await this.prisma.aiInteraction.aggregate({
        where: { createdAt: { gte: new Date(dayStart) } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
      });
      const next = {
        dayStart,
        requests: agg._count._all,
        tokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
        fetchedAt: Date.now(),
      };
      this.usageCache = next;
      return next;
    } catch (err) {
      this.logger.warn(`AI usage read failed: ${(err as Error).message}`);
      return cached && cached.dayStart === dayStart ? cached : { requests: 0, tokens: 0 };
    }
  }

  private recordUsage(tokens: number) {
    const dayStart = aiUsageDayStart().getTime();
    if (this.usageCache && this.usageCache.dayStart === dayStart) {
      this.usageCache.requests += 1;
      this.usageCache.tokens += Math.max(0, tokens);
    }
  }

  /** Why a new AI request must not be sent right now (disabled, over the daily budget, or a known outage). */
  async unavailableReason(options?: { ignoreOutage?: boolean }): Promise<AiUnavailableReason | null> {
    if (!this.gemini.isConfigured()) return 'NOT_CONFIGURED';
    const limits = await this.loadLimits();
    if (!limits.enabled) return 'DISABLED';
    const usage = await this.loadUsageToday();
    const budget = evaluateAiBudget({
      ...limits,
      requestsToday: usage.requests,
      tokensToday: usage.tokens,
    });
    if (budget) {
      this.alertLimitReached(budget, limits, usage);
      return budget;
    }
    return options?.ignoreOutage ? null : this.breaker.current();
  }

  private alertLimitReached(reason: AiUnavailableReason, limits: AiLimits, usage: { requests: number; tokens: number }) {
    const dayStart = aiUsageDayStart().getTime();
    if (this.lastLimitAlert?.dayStart === dayStart && this.lastLimitAlert.reason === reason) return;
    this.lastLimitAlert = { dayStart, reason };
    this.logger.error(
      JSON.stringify({
        event: 'AI_DAILY_LIMIT_REACHED',
        reason,
        requestsToday: usage.requests,
        tokensToday: usage.tokens,
        dailyRequestLimit: limits.dailyRequestLimit,
        dailyTokenLimit: limits.dailyTokenLimit,
      }),
    );
    void this.prisma.auditLog
      .create({
        data: {
          action: 'AI_DAILY_LIMIT_REACHED',
          resourceType: 'AI_USAGE',
          resourceId: new Date(dayStart).toISOString().slice(0, 10),
          newValue: JSON.stringify({ reason, ...usage, ...limits }),
        },
      })
      .catch(() => undefined);
  }

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
        unavailableReason: 'NOT_CONFIGURED',
      };
    }

    const blocked = await this.unavailableReason();
    if (blocked) {
      this.logger.warn(
        JSON.stringify({ event: 'AI_REQUEST_SKIPPED', task: request.task, reason: blocked, requestId: request.options?.requestId }),
      );
      return {
        success: false,
        data: null,
        provider: 'fallback',
        model: 'none',
        promptVersion,
        latencyMs: Date.now() - startTime,
        error: `AI unavailable: ${blocked}`,
        unavailableReason: blocked,
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
          timeoutMs: request.options?.timeoutMs,
          signal: request.options?.signal,
        },
      );
      this.breaker.close();
      this.recordUsage(result.inputTokens + result.outputTokens);

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
        unavailableReason: result.data ? undefined : 'FAILED',
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = (err as Error).message;
      const kind = classifyAiError(err);
      const callerAborted = Boolean(request.options?.signal?.aborted);
      if (!callerAborted && (kind === 'UPSTREAM_UNAVAILABLE' || kind === 'TIMEOUT')) {
        this.breaker.open(unavailableReasonFor(kind));
      }
      this.recordUsage(0);
      this.logger.error(`AI Gateway execution failed for ${request.task} (${kind}): ${errorMsg}`);

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
        unavailableReason: callerAborted ? 'TIMEOUT' : unavailableReasonFor(kind),
      };
    }
  }

  /**
   * Create or refresh a profile embedding in pgvector only (no JSON storage).
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
    if (await this.unavailableReason({ ignoreOutage: true })) {
      return { ok: false, dimensions: 0, reused: false };
    }

    const contentHash = createHash('sha256').update(text).digest('hex').slice(0, 40);
    try {
      const existing = await this.vectors.getProfileMeta(input.entityType, input.entityId);
      if (existing && existing.contentHash === contentHash) {
        return { ok: true, dimensions: existing.dimensions, reused: true };
      }
    } catch (err) {
      if (this.vectors.isUnavailable(err)) {
        this.vectors.logUnavailable(err);
        return { ok: false, dimensions: 0, reused: false };
      }
      throw err;
    }

    const start = Date.now();
    try {
      const embedded = await this.gemini.embed(text);
      if (!embedded.values.length) {
        return { ok: false, dimensions: 0, reused: false };
      }

      await this.vectors.upsertProfile({
        entityType: input.entityType,
        entityId: input.entityId,
        text,
        values: embedded.values,
        model: embedded.model,
      });
      this.recordUsage(Math.ceil(text.length / 4));

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
      if (this.vectors.isUnavailable(err)) this.vectors.logUnavailable(err);
      this.logger.warn(`Embedding failed for ${input.entityType}/${input.entityId}: ${(err as Error).message}`);
      return { ok: false, dimensions: 0, reused: false };
    }
  }

  async getEmbeddingVector(entityType: EmbeddingEntityType, entityId: string): Promise<number[] | null> {
    try {
      return await this.vectors.getProfileVector(entityType, entityId);
    } catch (err) {
      if (this.vectors.isUnavailable(err)) {
        this.vectors.logUnavailable(err);
        return null;
      }
      this.logger.warn(`pgvector profile read failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Profile-level similarity search in Postgres (pgvector). No in-memory JSON scan.
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
    if (await this.unavailableReason({ ignoreOutage: true })) return [];

    try {
      const embedded = await this.gemini.embed(query);
      if (!embedded.values.length) return [];
      return await this.vectors.searchProfiles({
        vector: embedded.values,
        entityTypes: input.entityTypes,
        limit: input.limit ?? 5,
        minScore: input.minScore ?? 0.35,
      });
    } catch (err) {
      if (this.vectors.isUnavailable(err)) this.vectors.logUnavailable(err);
      else this.logger.warn(`RAG retrieve failed: ${(err as Error).message}`);
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
      userPrompt: `Resume text:\n${rawText.slice(0, 12000)}`,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: 0,
        // Large resumes were truncating JSON mid-array (~4k tokens) and forcing retries.
        maxOutputTokens: 12288,
        timeoutMs: options?.timeoutMs ?? 60_000,
      },
    });
    if (res.data) return res.data;
    if (res.error) {
      throw new Error(`LLM resume structure failed: ${res.error}`);
    }
    throw new Error('LLM resume parser returned empty result.');
  }

  /** Strict schema parse from sanitized resume text (Gemini JSON). */
  async parseResumeStrictSchema(
    rawText: string,
    options?: AiRequestOptions,
  ): Promise<Record<string, unknown> | null> {
    const prompt = getPrompt('resume-parse-strict.v1');
    const res = await this.generate<Record<string, unknown>>({
      task: 'RESUME_PARSE_STRICT',
      systemPrompt: prompt.system,
      userPrompt: `Resume text:\n${rawText.slice(0, 16000)}`,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: 0,
        maxOutputTokens: 8192,
        timeoutMs: options?.timeoutMs ?? 60_000,
      },
    });
    return res.data;
  }

  /** Multimodal strict parse from PDF/image bytes (Gemini). Falls back gracefully if unsupported. */
  async parseResumeStrictFromFile(
    buffer: Buffer,
    mimeType: string,
    options?: AiRequestOptions,
  ): Promise<Record<string, unknown> | null> {
    if (!this.gemini.isConfigured() || typeof this.gemini.generateStructuredMultimodal !== 'function') {
      return null;
    }
    if (await this.unavailableReason()) return null;
    const prompt = getPrompt('resume-parse-strict.v1');
    const startTime = Date.now();
    try {
      const result = await this.gemini.generateStructuredMultimodal<Record<string, unknown>>(
        prompt.system,
        [
          {
            type: 'text',
            text: 'Extract the resume into the required JSON schema. Use only facts visible in the document.',
          },
          {
            type: 'inline',
            mimeType,
            dataBase64: buffer.toString('base64'),
          },
        ],
        {
          model: options?.model,
          temperature: 0,
          maxOutputTokens: options?.maxOutputTokens ?? 8192,
          timeoutMs: options?.timeoutMs ?? 60_000,
          signal: options?.signal,
        },
      );
      this.breaker.close();
      this.recordUsage(result.inputTokens + result.outputTokens);

      const latencyMs = Date.now() - startTime;
      this.logger.log(
        JSON.stringify({
          event: 'AI_INTERACTION',
          task: 'RESUME_PARSE_STRICT',
          provider: 'gemini',
          model: result.model,
          promptVersion: prompt.version,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          success: Boolean(result.data),
          multimodal: true,
          userId: options?.userId,
        }),
      );

      try {
        await this.prisma.aiInteraction.create({
          data: {
            userId: options?.userId || null,
            operation: 'RESUME_PARSE_STRICT',
            provider: 'gemini',
            model: result.model,
            promptVersion: prompt.version,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs,
            status: result.data ? 'SUCCESS' : 'FAILED',
            estimatedCostUsd: this.estimateCost(
              'gemini',
              result.model,
              result.inputTokens,
              result.outputTokens,
            ),
          },
        });
      } catch {
        /* audit best-effort */
      }

      return result.data;
    } catch (err) {
      const kind = classifyAiError(err);
      if (!options?.signal?.aborted && (kind === 'UPSTREAM_UNAVAILABLE' || kind === 'TIMEOUT')) {
        this.breaker.open(unavailableReasonFor(kind));
      }
      this.logger.warn(`parseResumeStrictFromFile failed (${kind}): ${(err as Error).message}`);
      return null;
    }
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

  async improveResumeSummaryWithStatus(
    input: { summary: string; targetRole?: string; profile?: Record<string, unknown>; avoidSuggestions?: string[] },
    options?: AiRequestOptions,
  ): Promise<{ data: { improvedSummary: string } | null; unavailableReason?: AiUnavailableReason }> {
    const prompt = getPrompt('resume-summary-improve.v1');
    const res = await this.generate<{ improvedSummary?: unknown }>({
      task: 'RESUME_REWRITE',
      systemPrompt: prompt.system,
      userPrompt: JSON.stringify(input).slice(0, 6000),
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: input.avoidSuggestions?.length ? 0.7 : 0.2,
        maxOutputTokens: 400,
      },
    });
    const improved = res.data && typeof res.data.improvedSummary === 'string' ? res.data.improvedSummary : null;
    if (!improved) return { data: null, unavailableReason: res.unavailableReason ?? 'FAILED' };
    return { data: { improvedSummary: improved } };
  }

  async improveExperienceBulletsWithStatus(
    input: { role: string; company?: string; bullets: string[]; targetRole?: string; avoidSuggestions?: string[] },
    options?: AiRequestOptions,
  ): Promise<{ data: { improvedBullets: string[] } | null; unavailableReason?: AiUnavailableReason }> {
    const prompt = getPrompt('resume-experience-improve.v1');
    const res = await this.generate<{ improvedBullets?: unknown }>({
      task: 'RESUME_REWRITE',
      systemPrompt: prompt.system,
      userPrompt: JSON.stringify(input).slice(0, 4000),
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: input.avoidSuggestions?.length ? 0.7 : 0.2,
        maxOutputTokens: 500,
      },
    });
    const raw = res.data?.improvedBullets;
    const bullets = Array.isArray(raw)
      ? raw
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.replace(/^[\s•\-*]+/, '').trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    if (!bullets.length) return { data: null, unavailableReason: res.unavailableReason ?? 'FAILED' };
    return { data: { improvedBullets: bullets } };
  }

  async reviewResume(
    content: unknown,
    targetRole?: string,
    options?: AiRequestOptions,
  ): Promise<ResumeReviewResult | null> {
    return (await this.reviewResumeWithStatus(content, targetRole, options)).data;
  }

  async reviewResumeWithStatus(
    content: unknown,
    targetRole?: string,
    options?: AiRequestOptions,
  ): Promise<{ data: ResumeReviewResult | null; unavailableReason?: AiUnavailableReason }> {
    const blocked = await this.unavailableReason();
    if (blocked) return { data: null, unavailableReason: blocked };
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
    return { data: res.data, unavailableReason: res.data ? undefined : res.unavailableReason ?? 'FAILED' };
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
    options?: AiRequestOptions & {
      questionTypeHint?: string;
      evaluationCriteria?: string[];
    },
  ): Promise<InterviewEvaluationResult | null> {
    const prompt = getPrompt('interview-evaluation.v1');
    const userPayload = JSON.stringify({
      profile,
      question,
      answer,
      questionTypeHint: options?.questionTypeHint || null,
      evaluationCriteria: options?.evaluationCriteria || null,
      instructions: [
        'Follow the system steps in order: classify → evaluate with type criteria → list whatWasMissing → write improvementSuggestion → THEN write improvedAnswer that fixes those gaps.',
        'improvedAnswer must not be a near-copy of answer when whatWasMissing is non-empty.',
      ],
    });
    const res = await this.generate<InterviewEvaluationResult>({
      task: 'INTERVIEW_EVALUATION',
      systemPrompt: prompt.system,
      userPrompt: userPayload,
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: options?.temperature ?? 0.35,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
      },
    });
    return res.data;
  }

  async generateInterviewQuestion(
    input: {
      interviewType: string;
      questionNumber: number;
      askedQuestions: string[];
      lastExchange?: { question: string; answer: string } | null;
      profile: unknown;
      coverageFocus?: string;
      retrievedChunks?: string[];
    },
    options?: AiRequestOptions,
  ): Promise<{
    question: string;
    category: string;
    hint?: string;
    thinkSeconds?: number;
  } | null> {
    const prompt = getPrompt('interview-question.v1');
    const res = await this.generate<{
      question?: string;
      category?: string;
      hint?: string;
      thinkSeconds?: number;
    }>({
      task: 'INTERVIEW_QUESTION',
      systemPrompt: [
        prompt.system,
        'Use retrievedChunks when present. They are the candidate resume passages most relevant to this question, each prefixed with its [Section]. Prefer a specific company, project, achievement, or technology from those passages over a generic question.',
        'Never invent projects, companies, products, metrics, or achievements. Only reference specifics that appear in retrievedChunks or profile; if retrievedChunks is empty, do not claim the resume says something.',
        'coverageFocus tells you which profile area to emphasize for THIS question — follow it, while still staying natural.',
        'Question 1 is already a fixed intro elsewhere. Never ask "tell me about yourself" or "who are you" again.',
        'Rotate topics across questions. Prefer a new profile area over repeating the same project/skill.',
        'Respect experienceLevel strictly: FRESHER = simple beginner questions; YEAR_1 = fundamentals; YEAR_2_3 = applied depth; YEAR_4_PLUS = harder design/ownership.',
        'Do not ask senior-level architecture questions when experienceLevel is FRESHER.',
        'Do not repeat any previously asked question.',
        'If the last answer mentioned something concrete, a short follow-up is allowed, then move to another profile area next.',
        'Keep the question clear, realistic, and answerable in 1-2 minutes.',
        'Match interviewType: TECHNICAL → tech depth; ROLE/ROLE_BASED → role fit; BEHAVIOURAL/GENERIC/HR → soft skills; RESUME → resume projects; MIXED → rotate.',
        'category one of TECHNICAL, PROJECT, EXPERIENCE, BEHAVIOURAL, ROLE, SCENARIO, FOLLOW_UP, EDUCATION.',
      ].join(' '),
      userPrompt: buildInterviewQuestionUserPrompt(input),
      options: {
        ...options,
        promptVersion: prompt.version,
        temperature: options?.temperature ?? 0.55,
        maxOutputTokens: options?.maxOutputTokens ?? 1024,
      },
    });
    let question = (res.data?.question || '').trim();
    if (!question && res.rawText) {
      try {
        const match = res.rawText.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { question?: string; category?: string; hint?: string; thinkSeconds?: number };
          question = (parsed.question || '').trim();
          if (question.length >= 12) {
            return {
              question,
              category: (parsed.category || 'MIXED').toUpperCase(),
              hint: parsed.hint,
              thinkSeconds: parsed.thinkSeconds,
            };
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (question.length < 12) return null;
    return {
      question,
      category: (res.data?.category || 'MIXED').toUpperCase(),
      hint: res.data?.hint,
      thinkSeconds: res.data?.thinkSeconds,
    };
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

/** Resume passages go first so the 12k character cap trims the profile, never the retrieved context. */
export function buildInterviewQuestionUserPrompt(input: {
  interviewType: string;
  questionNumber: number;
  askedQuestions: string[];
  lastExchange?: { question: string; answer: string } | null;
  profile: unknown;
  coverageFocus?: string;
  retrievedChunks?: string[];
}): string {
  return JSON.stringify({
    retrievedChunks: input.retrievedChunks || [],
    coverageFocus: input.coverageFocus,
    interviewType: input.interviewType,
    questionNumber: input.questionNumber,
    askedQuestions: input.askedQuestions,
    lastExchange: input.lastExchange || null,
    profile: input.profile,
  }).slice(0, 12000);
}
