import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from '@google/genai';
import { ErrorCode } from '@careerbridge/shared';
import { classifyAiError, linkedAbort, raceAbort } from './ai-resilience';
import { normalizeTtsAudio } from './tts-wav';
import { sanitizeAiClientError } from './ai-client-error';

const MAX_CHARS = 2200;
/** Firm female voice — Google prebuilt "Kore" (firm). */
const DEFAULT_VOICE = 'Kore';
const DEFAULT_LANGUAGE = 'en-IN';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const STYLE =
  'firm, professional Indian English accent, clear hard tone, assertive interviewer, natural pace, no softness';

export type TtsResult = {
  audioBase64: string;
  mimeType: 'audio/wav';
  voice: string;
  language: string;
  model: string;
};

type CacheEntry = { result: TtsResult; at: number };

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private client: GoogleGenAI | null = null;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMax = 48;

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

  private getClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Interview voice is not configured.',
      });
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  private voice(): string {
    return this.config.get<string>('GEMINI_TTS_VOICE')?.trim() || DEFAULT_VOICE;
  }

  private language(): string {
    return this.config.get<string>('GEMINI_TTS_LANGUAGE')?.trim() || DEFAULT_LANGUAGE;
  }

  private model(): string {
    return this.config.get<string>('GEMINI_TTS_MODEL')?.trim() || DEFAULT_MODEL;
  }

  private timeoutMs(): number {
    const value = Number(this.config.get<string>('GEMINI_TTS_TIMEOUT_MS') || 25000);
    return Number.isFinite(value) && value > 0 ? value : 25000;
  }

  private stylePrompt(text: string): string {
    // Style cue + exact recitation — keeps accent/tone consistent across devices.
    return `Say in a ${STYLE}: ${text}`;
  }

  private cacheKey(text: string): string {
    return `${this.model()}|${this.voice()}|${this.language()}|${text}`;
  }

  private remember(key: string, result: TtsResult) {
    if (this.cache.size >= this.cacheMax) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { result, at: Date.now() });
  }

  async synthesize(rawText: string): Promise<TtsResult> {
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (text.length < 1) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Speech text is required.',
      });
    }
    if (text.length > MAX_CHARS) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Speech text must be at most ${MAX_CHARS} characters.`,
      });
    }

    const key = this.cacheKey(text);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30 * 60_000) {
      return hit.result;
    }

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Interview voice is not configured.',
      });
    }

    const client = this.getClient();
    const voice = this.voice();
    const language = this.language();
    const primary = this.model();
    const fallback =
      this.config.get<string>('GEMINI_TTS_FALLBACK_MODEL')?.trim() || 'gemini-2.5-pro-preview-tts';
    const models = [primary, fallback].filter(
      (model, index, all) => Boolean(model) && all.indexOf(model) === index,
    );

    for (const model of models) {
      const { signal, dispose } = linkedAbort(undefined, this.timeoutMs());
      try {
        const response = await raceAbort(
          client.models.generateContent({
            model,
            contents: this.stylePrompt(text),
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                languageCode: language,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
              abortSignal: signal,
            },
          }),
          signal,
        );

        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        const inline = part?.inlineData;
        if (!inline?.data) {
          throw new Error('TTS returned no audio');
        }

        const raw = Buffer.from(inline.data, 'base64');
        const { wav, mimeType } = normalizeTtsAudio(raw, inline.mimeType);
        const result: TtsResult = {
          audioBase64: wav.toString('base64'),
          mimeType,
          voice,
          language,
          model,
        };
        this.remember(key, result);
        return result;
      } catch (err) {
        const kind = classifyAiError(err);
        const msg = sanitizeAiClientError(err instanceof Error ? err.message : String(err));
        this.logger.error(`TTS failed (${model}, ${kind}): ${msg}`);
        if (kind === 'TIMEOUT') break;
      } finally {
        dispose();
      }
    }

    throw new ServiceUnavailableException({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Interview voice is temporarily unavailable.',
    });
  }
}
