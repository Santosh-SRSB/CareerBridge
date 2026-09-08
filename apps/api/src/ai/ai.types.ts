export type AiProviderName = 'gemini' | 'fallback';

export type AiTaskType =
  | 'RESUME_REVIEW'
  | 'RESUME_REWRITE'
  | 'RESUME_STRUCTURE'
  | 'INTERVIEW_EVALUATION'
  | 'INTERVIEW_QUESTION'
  | 'JOB_MATCHING'
  | 'SKILL_EXTRACTION'
  | 'EMBEDDING'
  | 'RAG_RETRIEVE'
  | 'GENERAL';

export type EmbeddingEntityType =
  | 'CANDIDATE'
  | 'JOB'
  | 'RESUME'
  | 'SKILL'
  | 'KNOWLEDGE';

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

export interface StructuredResumeDraft {
  firstName: string;
  lastName: string;
  city: string;
  about: string;
  education: Array<{
    qualification: string;
    institution: string;
    fieldOfStudy: string;
    yearCompleted: string;
  }>;
  skills: string[];
  careerInterests: string[];
  experience: Array<{
    company: string;
    jobTitle: string;
    isInternship: boolean;
    description: string;
  }>;
  projects: Array<{
    title: string;
    role: string;
    year: string;
    description: string;
    url: string;
  }>;
}
