import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiProvider, ProviderGenerateOptions, ProviderGenerateResult } from './ai-provider.interface';
import { AiProviderName } from '../ai.types';

@Injectable()
export class OpenAIProvider implements AiProvider {
  readonly name: AiProviderName = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    return (
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
      this.config.get<string>('Open_Ai_Api_key')?.trim() ||
      ''
    );
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getDefaultModel(): string {
    return this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
  }

  private getClient(): OpenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey });
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
      const completion = await client.chat.completions.create({
        model,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const rawText = completion.choices[0]?.message?.content || '';
      let data: T | null = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText) as T;
        } catch (e) {
          this.logger.warn(`Failed to parse OpenAI JSON output: ${(e as Error).message}`);
        }
      }

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      return {
        data,
        rawText,
        model,
        inputTokens,
        outputTokens,
      };
    } catch (err) {
      this.logger.error(`OpenAI generation error: ${(err as Error).message}`);
      throw err;
    }
  }
}
