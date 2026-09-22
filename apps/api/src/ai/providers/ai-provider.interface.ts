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

export type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'inline'; mimeType: string; dataBase64: string };

export interface AiProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  getDefaultModel(): string;
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: ProviderGenerateOptions,
  ): Promise<ProviderGenerateResult<T>>;
  /** Optional multimodal path (PDF/image bytes). Providers may omit. */
  generateStructuredMultimodal?<T>(
    systemPrompt: string,
    parts: MultimodalPart[],
    options?: ProviderGenerateOptions,
  ): Promise<ProviderGenerateResult<T>>;
}
