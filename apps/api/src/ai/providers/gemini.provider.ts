import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiProvider, ProviderGenerateOptions, ProviderGenerateResult } from './ai-provider.interface';
import { AiProviderName } from '../ai.types';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name: AiProviderName = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    return (
      this.config.get<string>('GEMINI_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_GENAI_API_KEY')?.trim() ||
      ''
    );
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getDefaultModel(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-3.6-flash';
  }

  getEmbeddingModel(): string {
    return this.config.get<string>('GEMINI_EMBEDDING_MODEL')?.trim() || 'text-embedding-004';
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: ProviderGenerateOptions,
  ): Promise<ProviderGenerateResult<T>> {
    const client = this.getClient();
    const primary = options?.model || this.getDefaultModel();
    const fallback =
      this.config.get<string>('GEMINI_FALLBACK_MODEL')?.trim() || 'gemini-2.5-flash';
    const models = primary === fallback ? [primary] : [primary, fallback];

    let lastError: unknown;
    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: options?.temperature ?? 0.2,
              maxOutputTokens: options?.maxOutputTokens,
              responseMimeType: 'application/json',
            },
          });

          const rawText = response.text || '';
          let data: T | null = null;
          if (rawText) {
            try {
              data = JSON.parse(rawText) as T;
            } catch {
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                try {
                  data = JSON.parse(match[0]) as T;
                } catch (e) {
                  this.logger.warn(`Failed to parse Gemini JSON output: ${(e as Error).message}`);
                }
              } else {
                this.logger.warn('Failed to parse Gemini JSON output: no JSON object found');
              }
            }
          }

          const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
          const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

          return {
            data,
            rawText,
            model,
            inputTokens,
            outputTokens,
          };
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          const retryable = /503|UNAVAILABLE|high demand|temporarily|resource.?exhausted|429/i.test(
            msg,
          );
          this.logger.error(`Gemini generation error (${model} attempt ${attempt + 1}): ${msg}`);
          if (retryable && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          // Try next model if available
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async embed(text: string, options?: { model?: string; dimensions?: number }): Promise<{
    values: number[];
    model: string;
  }> {
    const client = this.getClient();
    const model = options?.model || this.getEmbeddingModel();
    const trimmed = text.trim().slice(0, 8000);
    if (!trimmed) {
      return { values: [], model };
    }

    const response = await client.models.embedContent({
      model,
      contents: trimmed,
      config: options?.dimensions
        ? { outputDimensionality: options.dimensions }
        : undefined,
    });

    const values = response.embeddings?.[0]?.values || [];
    return { values: [...values], model };
  }
}
