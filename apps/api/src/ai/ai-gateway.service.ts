import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AiProvider } from './providers/ai-provider.interface';
import {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderName,
  AiRequestOptions,
  AiTaskType,
} from './ai.types';
import { getPrompt, PROMPT_REGISTRY } from './prompts/prompt-registry';
import {
  InterviewEvaluationResult,
  InterviewQuestionResult,
  JobMatchResult,
  ResumeReviewResult,
  ResumeRewriteResult,
} from './schemas/ai-response.schemas';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiProvider,
    private readonly openai: OpenAIProvider,
  ) {}

  /**
   * Determine available AI provider.
   * Priority: explicit option -> Gemini (GCP primary per HLD) -> OpenAI (fallback) -> null.
   */
  private resolveProvider(requested?: AiProviderName): AiProvider | null {
    if (requested === 'gemini') return this.gemini.isConfigured() ? this.gemini : null;
    if (requested === 'openai') return this.openai.isConfigured() ? this.openai : null;

    if (this.gemini.isConfigured()) return this.gemini;
    if (this.openai.isConfigured()) return this.openai;
    return null;
  }

  /**
   * Check if any AI provider is configured and available.
   */
  isConfigured(): boolean {
    return this.gemini.isConfigured() || this.openai.isConfigured();
  }

  /**
   * Get active provider name for telemetry/diagnostics.
   */
  getActiveProviderName(): AiProviderName {
    if (this.gemini.isConfigured()) return 'gemini';
    if (this.openai.isConfigured()) return 'openai';
    return 'fallback';
  }

  /**
   * Calculate rough USD cost for telemetry.
   */
  private estimateCost(provider: AiProviderName, model: string, inputTokens: number, outputTokens: number): number {
    if (provider === 'gemini') {
      // e.g. Gemini 2.5 Flash: ~$0.075 / 1M input, $0.30 / 1M output
      return (inputTokens * 0.075 + outputTokens * 0.3) / 1_000_000;
    }
    if (provider === 'openai') {
      // e.g. GPT-4o-mini: ~$0.15 / 1M input, $0.60 / 1M output
      return (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
    }
    return 0;
  }

  /**
   * Central generate method for structured JSON tasks.
   */
  async generate<T>(request: AiGenerateRequest): Promise<AiGenerateResponse<T>> {
    const startTime = Date.now();
    const promptVersion = request.options?.promptVersion || `${request.task.toLowerCase()}.v1`;
    const provider = this.resolveProvider(request.options?.provider);

    if (!provider) {
      this.logger.warn(`No AI provider configured for task "${request.task}". Returning fallback.`);
      return {
        success: false,
        data: null,
        provider: 'fallback',
        model: 'none',
        promptVersion,
        latencyMs: Date.now() - startTime,
        error: 'No AI provider configured (set GEMINI_API_KEY or OPENAI_API_KEY)',
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

      // Telemetry log according to Volume 2 Section 2C.27 (ai_interactions)
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

      // Failover logic: if Gemini failed and OpenAI is available, try fallback
      if (provider.name === 'gemini' && this.openai.isConfigured() && !request.options?.provider) {
        this.logger.warn(`Gemini failed (${errorMsg}), attempting failover to OpenAI...`);
        try {
          const fallbackResult = await this.openai.generateStructured<T>(
            request.systemPrompt,
            request.userPrompt,
            {
              temperature: request.options?.temperature,
              maxOutputTokens: request.options?.maxOutputTokens,
            },
          );
          return {
            success: Boolean(fallbackResult.data),
            data: fallbackResult.data,
            rawText: fallbackResult.rawText,
            provider: 'openai',
            model: fallbackResult.model,
            promptVersion,
            inputTokens: fallbackResult.inputTokens,
            outputTokens: fallbackResult.outputTokens,
            latencyMs: Date.now() - startTime,
          };
        } catch (failoverErr) {
          this.logger.error(`Failover to OpenAI also failed: ${(failoverErr as Error).message}`);
        }
      }

      this.logger.error(`AI Gateway execution failed for ${request.task}: ${errorMsg}`);
      return {
        success: false,
        data: null,
        provider: provider.name,
        model: 'unknown',
        promptVersion,
        latencyMs,
        error: errorMsg,
      };
    }
  }

  /**
   * Higher-level domain methods
   */

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
    const userPayload = JSON.stringify({ content, targetRole });
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
}
