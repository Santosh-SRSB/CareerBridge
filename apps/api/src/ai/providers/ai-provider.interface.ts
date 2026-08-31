import { AiProviderName } from '../ai.types';

export interface ProviderGenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ProviderGenerateResult<T> {
  data: T | null;
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  getDefaultModel(): string;
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: ProviderGenerateOptions,
  ): Promise<ProviderGenerateResult<T>>;
}
