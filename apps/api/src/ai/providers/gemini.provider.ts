import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  AiProvider,
  MultimodalPart,
  ProviderGenerateOptions,
  ProviderGenerateResult,
} from './ai-provider.interface';
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
    return this.config.get<string>('GEMINI_EMBEDDING_MODEL')?.trim() || 'gemini-embedding-001';
  }

  /** Must match the vector(N) columns in profile_embeddings / embedding_chunks. */
  getEmbeddingDimensions(): number {
    const value = Number(this.config.get<string>('EMBEDDING_DIMENSIONS') || 768);
    return Number.isFinite(value) && value > 0 ? value : 768;
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

  async generateStructuredMultimodal<T>(
    systemPrompt: string,
    parts: MultimodalPart[],
    options?: ProviderGenerateOptions,
  ): Promise<ProviderGenerateResult<T>> {
    const client = this.getClient();
    const model = options?.model || this.getDefaultModel();

    const contents = parts.map((part) => {
      if (part.type === 'text') return { text: part.text };
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.dataBase64,
        },
      };
    });

    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: contents }],
        config: {
          systemInstruction: systemPrompt,
          temperature: options?.temperature ?? 0,
          maxOutputTokens: options?.maxOutputTokens ?? 8192,
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
              this.logger.warn(`Failed to parse Gemini multimodal JSON: ${(e as Error).message}`);
            }
          }
        }
      }

      return {
        data,
        rawText,
        model,
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (err) {
      this.logger.error(`Gemini multimodal error: ${(err as Error).message}`);
      throw err;
    }
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

    const expected = options?.dimensions || this.getEmbeddingDimensions();
    const response = await client.models.embedContent({
      model,
      contents: trimmed,
      config: { outputDimensionality: expected },
    });

    const values = response.embeddings?.[0]?.values || [];
    if (values.length && values.length !== expected) {
      throw new Error(
        `Embedding length ${values.length} does not match EMBEDDING_DIMENSIONS=${expected}. Align the model and the vector(N) column before storing.`,
      );
    }
    return { values: normalizeVector(values), model };
  }

  /**
   * Batch embedding for indexing: one request per 100 texts instead of one per chunk. Retries rate limits
   * with backoff because indexing runs in the background worker; interview-time retrieval uses embed().
   */
  async embedMany(
    texts: string[],
    options?: { retries?: number; backoffMs?: number },
  ): Promise<{ vectors: number[][]; model: string; requests: number }> {
    const model = this.getEmbeddingModel();
    const expected = this.getEmbeddingDimensions();
    const retries = options?.retries ?? 3;
    const backoffMs = options?.backoffMs ?? 5000;
    const vectors: number[][] = [];
    let requests = 0;
    for (let start = 0; start < texts.length; start += 100) {
      const slice = texts.slice(start, start + 100).map((text) => text.trim().slice(0, 8000));
      if (slice.some((text) => !text)) throw new Error('Cannot embed empty text');
      for (let attempt = 0; ; attempt += 1) {
        try {
          requests += 1;
          const response = await this.getClient().models.embedContent({
            model,
            contents: slice,
            config: { outputDimensionality: expected },
          });
          const list = response.embeddings || [];
          if (list.length !== slice.length) {
            throw new Error(`Embedding provider returned ${list.length} vectors for ${slice.length} texts`);
          }
          for (const item of list) {
            const values = item.values || [];
            if (values.length !== expected) {
              throw new Error(
                `Embedding length ${values.length} does not match EMBEDDING_DIMENSIONS=${expected}. Align the model and the vector(N) column before storing.`,
              );
            }
            vectors.push(normalizeVector(values));
          }
          break;
        } catch (err) {
          if (attempt < retries && isRateLimited(err)) {
            await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
    }
    return { vectors, model, requests };
  }
}

function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|rate limit/i.test(message);
}

/** Truncated gemini-embedding-001 outputs are not unit length; normalize so dot product equals cosine. */
export function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) return [...values];
  return values.map((value) => value / norm);
}
