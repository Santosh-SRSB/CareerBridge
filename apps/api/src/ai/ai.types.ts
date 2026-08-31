export type AiProviderName = 'gemini' | 'openai' | 'fallback';

export type AiTaskType =
  | 'RESUME_REVIEW'
  | 'RESUME_REWRITE'
  | 'INTERVIEW_EVALUATION'
  | 'INTERVIEW_QUESTION'
  | 'JOB_MATCHING'
  | 'SKILL_EXTRACTION'
  | 'GENERAL';

export interface AiRequestOptions {
  model?: string;
  provider?: AiProviderName;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  promptVersion?: string;
  userId?: string;
  requestId?: string;
}

export interface AiGenerateRequest {
  task: AiTaskType;
  systemPrompt: string;
  userPrompt: string;
  options?: AiRequestOptions;
}

export interface AiGenerateResponse<T = unknown> {
  success: boolean;
  data: T | null;
  rawText?: string;
  provider: AiProviderName;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  estimatedCostUsd?: number;
  error?: string;
}

export interface AiInteractionRecord {
  id: string;
  userId?: string | null;
  operation: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: 'SUCCESS' | 'FAILED' | 'FALLBACK';
  estimatedCostUsd: number;
  createdAt: Date;
}
