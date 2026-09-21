/**
 * Upgraded resume parse pipeline:
 * 1) layout-aware text extract (spatial columns + sanitation)
 * 2) Gemini strict JSON schema (text or multimodal PDF)
 * 3) heuristic fallback → coerce schema
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ResumeContent } from '@careerbridge/shared';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { ResumeExtractorService } from './resume-extractor.service';
import { parseExtractedResumeText } from './parse-extracted-resume';
import { parseResumeTextWithOptionalAi } from './structure-resume-content';
import { applyContentGroundingGate } from './content-grounding-gate';
import { sanitizeExtractedResumeText, sanitizeParsedResumeSchema } from './layout-sanitize';
import {
  coerceParsedResumeSchema,
  isParsedResumeSchemaMostlyEmpty,
  type ParsedResumeMeta,
  type ParsedResumeResponse,
  type ParsedResumeSchema,
} from './parsed-resume.schema';
import { parsedSchemaToResumeContent, resumeContentToParsedSchema } from './parsed-resume-map';

export type ParseResumeInput = {
  buffer?: Buffer;
  mimeType?: string;
  fileName?: string;
  rawText?: string;
  userId?: string;
};

@Injectable()
export class ParseResumePipeline {
  private readonly logger = new Logger(ParseResumePipeline.name);

  constructor(
    private readonly extractor: ResumeExtractorService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async parse(input: ParseResumeInput): Promise<ParsedResumeResponse> {
    const warnings: string[] = [];
    let layoutMode: ParsedResumeMeta['layoutMode'] = 'heuristic-text';
    let extractorName = 'none';
    let rawText = (input.rawText || '').trim();

    try {
      if (!rawText && input.buffer?.length) {
        const extraction = await this.extractor.extract(
          input.buffer,
          input.mimeType || 'application/octet-stream',
          input.fileName || 'resume',
        );
        extractorName = extraction.extractor;
        rawText = extraction.text || '';
        if (extraction.notes?.length) warnings.push(...extraction.notes.slice(0, 8));
        layoutMode = 'spatial-text';
      }

      if (!rawText.trim()) {
        return {
          ok: false,
          data: coerceParsedResumeSchema(null).data,
          meta: {
            extractor: extractorName,
            layoutMode: 'fallback',
            partial: true,
            warnings: [...warnings, 'empty_extract'],
          },
          rawText: '',
          rawTextPreview: '',
          error: 'Could not extract text from the resume. Try a clearer PDF or DOCX.',
        };
      }

      // Layout sanitation before any structure parse
      const cleaned = sanitizeExtractedResumeText(rawText);
      rawText = cleaned || rawText;

      let schema: ParsedResumeSchema | null = null;
      let groundingRejected: ParsedResumeMeta['groundingRejected'];

      // Prefer multimodal Gemini when we have PDF/image bytes
      const mime = (input.mimeType || '').toLowerCase();
      const canMultimodal =
        this.aiGateway.isConfigured() &&
        input.buffer &&
        input.buffer.length > 0 &&
        input.buffer.length < 8 * 1024 * 1024 &&
        (mime.includes('pdf') || mime.startsWith('image/') || /\.pdf$/i.test(input.fileName || ''));

      if (canMultimodal) {
        try {
          const multimodal = await this.aiGateway.parseResumeStrictFromFile(
            input.buffer!,
            mime.includes('pdf') || /\.pdf$/i.test(input.fileName || '')
              ? 'application/pdf'
              : mime || 'image/png',
            { userId: input.userId },
          );
          if (multimodal) {
            const coerced = coerceParsedResumeSchema(multimodal);
            schema = sanitizeParsedResumeSchema(coerced.data);
            warnings.push(...coerced.warnings);
            layoutMode = 'llm-multimodal';
          }
        } catch (err) {
          warnings.push(`multimodal_failed:${(err as Error).message.slice(0, 80)}`);
          this.logger.warn(`Multimodal parse failed: ${(err as Error).message}`);
        }
      }

      // Text LLM structured parse
      if ((!schema || isParsedResumeSchemaMostlyEmpty(schema)) && this.aiGateway.isConfigured()) {
        try {
          const structured = await this.aiGateway.parseResumeStrictSchema(rawText, {
            userId: input.userId,
          });
          if (structured) {
            const coerced = coerceParsedResumeSchema(structured);
            schema = sanitizeParsedResumeSchema(coerced.data);
            warnings.push(...coerced.warnings);
            layoutMode = 'llm-text';
          }
        } catch (err) {
          warnings.push(`llm_text_failed:${(err as Error).message.slice(0, 80)}`);
        }
      }

      // Heuristic (+ optional legacy structure merge) fallback
      if (!schema || isParsedResumeSchemaMostlyEmpty(schema)) {
        const parsed = await parseResumeTextWithOptionalAi(rawText, (text) =>
          this.aiGateway.isConfigured()
            ? this.aiGateway.structureResumeText(text, { userId: input.userId })
            : Promise.resolve(null),
        );
        const gated = applyContentGroundingGate(parsed, rawText);
        groundingRejected = gated.rejected.slice(0, 40);
        schema = sanitizeParsedResumeSchema(resumeContentToParsedSchema(gated.content));
        layoutMode = this.aiGateway.isConfigured() ? 'llm-text' : 'heuristic-text';
        if (gated.rejected.length) warnings.push(`grounding_rejected:${gated.rejected.length}`);
      } else {
        // Ground LLM schema against source text
        const asContent = parsedSchemaToResumeContent(schema);
        const gated = applyContentGroundingGate(asContent, rawText);
        groundingRejected = gated.rejected.slice(0, 40);
        schema = sanitizeParsedResumeSchema(resumeContentToParsedSchema(gated.content));
        if (gated.rejected.length) warnings.push(`grounding_rejected:${gated.rejected.length}`);
      }

      const finalCoerce = coerceParsedResumeSchema(schema);
      schema = sanitizeParsedResumeSchema(finalCoerce.data);
      warnings.push(...finalCoerce.warnings);

      const partial =
        finalCoerce.partial ||
        isParsedResumeSchemaMostlyEmpty(schema) ||
        Boolean(groundingRejected?.length);

      return {
        ok: !isParsedResumeSchemaMostlyEmpty(schema),
        data: schema,
        meta: {
          extractor: extractorName,
          layoutMode,
          partial,
          warnings: [...new Set(warnings)].slice(0, 24),
          groundingRejected,
        },
        rawText,
        rawTextPreview: rawText.slice(0, 500),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`parse-resume pipeline failed: ${message}`);
      // Last-resort heuristic on whatever text we have
      let fallback = coerceParsedResumeSchema(null).data;
      try {
        if (rawText.trim()) {
          const heuristic = parseExtractedResumeText(sanitizeExtractedResumeText(rawText));
          fallback = sanitizeParsedResumeSchema(resumeContentToParsedSchema(heuristic));
        }
      } catch {
        /* empty */
      }
      return {
        ok: !isParsedResumeSchemaMostlyEmpty(fallback),
        data: fallback,
        meta: {
          extractor: extractorName,
          layoutMode: 'fallback',
          partial: true,
          warnings: [...warnings, 'pipeline_exception'],
        },
        rawText,
        rawTextPreview: rawText.slice(0, 500),
        error: message.slice(0, 500),
      };
    }
  }

  /** Convenience for upload processor — returns ResumeContent + meta. */
  async parseToResumeContent(input: ParseResumeInput): Promise<{
    content: ResumeContent;
    rawText: string;
    response: ParsedResumeResponse;
  }> {
    const response = await this.parse(input);
    const content = parsedSchemaToResumeContent(response.data);
    return {
      content,
      rawText: response.rawText || input.rawText || '',
      response,
    };
  }
}
