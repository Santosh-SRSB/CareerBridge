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
      this.config.get<string>('GEMINI_FALLBACK_MODEL')?.trim() || 'gemini-2.0-flash';
    // Never fall back to a removed model id (gemini-2.5-flash 404s for new keys).
    const models = [primary, fallback].filter(
      (model, index, all) => Boolean(model) && all.indexOf(model) === index,
    );

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
            data = this.parseJsonLoose<T>(rawText);
            if (!data) {
              // Truncated / invalid JSON — retry same model instead of burning the whole call.
              throw new Error('Gemini returned invalid JSON (likely truncated). Retrying.');
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
          const retryable =
            /503|UNAVAILABLE|high demand|temporarily|resource.?exhausted|429|invalid JSON|truncated/i.test(
              msg,
            );
          this.logger.error(`Gemini generation error (${model} attempt ${attempt + 1}): ${msg}`);
          if (retryable && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            continue;
          }
          // Try next model if available
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** Best-effort JSON parse, including lightly truncated array/object tails. */
  private parseJsonLoose<T>(rawText: string): T | null {
    const tryParse = (text: string): T | null => {
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    };

    const direct = tryParse(rawText);
    if (direct) return direct;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const object = tryParse(match[0]);
      if (object) return object;
      const repaired = this.repairTruncatedJson(match[0]);
      if (repaired) {
        const fixed = tryParse(repaired);
        if (fixed) return fixed;
      }
    }

    this.logger.warn('Failed to parse Gemini JSON output after repair attempts');
    return null;
  }

  private repairTruncatedJson(text: string): string | null {
    let s = text.trim();
    // Drop trailing incomplete string / token after last safe comma or bracket.
    s = s.replace(/,\s*("[^"]*)?$/u, '');
    const opens: string[] = [];
    let inString = false;
    let escape = false;
    for (const ch of s) {
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{' || ch === '[') opens.push(ch === '{' ? '}' : ']');
      if (ch === '}' || ch === ']') opens.pop();
    }
    if (inString) s += '"';
    while (opens.length) s += opens.pop();
    return s;
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
    });

    const values = response.embeddings?.[0]?.values || [];
    const expected = Number(this.config.get<string>('EMBEDDING_DIMENSIONS') || 768);
    if (values.length && expected > 0 && values.length !== expected) {
      throw new Error(
        `Embedding length ${values.length} does not match EMBEDDING_DIMENSIONS=${expected}. Align the model and the vector(N) column before storing.`,
      );
    }
    return { values: [...values], model };
  }
}
