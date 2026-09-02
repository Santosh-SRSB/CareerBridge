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
    return this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
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
    const model = options?.model || this.getDefaultModel();

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
        } catch (e) {
          this.logger.warn(`Failed to parse Gemini JSON output: ${(e as Error).message}`);
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
      this.logger.error(`Gemini generation error: ${(err as Error).message}`);
      throw err;
    }
  }
}
