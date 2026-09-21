/**
 * Resume text extraction — Google Document AI only (no pdf-parse / mammoth / tesseract).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gcpClientOptions } from '../common/gcp/gcp-credentials';

export type ResumeExtractionResult = {
  text: string;
  extractor: 'document-ai';
  mimeType: string;
  fileName: string;
  pageCount?: number;
  confidence?: number;
  notes: string[];
};

async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  logger: Logger,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`${label} attempt ${i + 1}/${attempts} failed: ${msg}`);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

@Injectable()
export class ResumeExtractorService {
  private readonly logger = new Logger(ResumeExtractorService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(buffer: Buffer, mimeType: string, fileName: string): Promise<ResumeExtractionResult> {
    const attempts = Number(this.config.get('DOCUMENT_AI_MAX_RETRIES') || 3) || 3;
    const result = await withRetries(
      'Document AI',
      () => this.extractDocumentAi(buffer, mimeType || 'application/pdf'),
      Math.max(1, attempts),
      900,
      this.logger,
    );

    if (!result.text.trim()) {
      throw new Error(
        `Document AI returned empty text. ${result.notes.join('; ') || 'Check processor and billing.'}`,
      );
    }

    return {
      ...result,
      mimeType: mimeType || 'application/pdf',
      fileName: fileName || 'resume.pdf',
    };
  }

  private async extractDocumentAi(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    const project = this.config.get<string>('GCP_PROJECT_ID', '');
    const location = this.config.get<string>('DOCUMENT_AI_LOCATION', 'asia-south1');
    const processorId = this.config.get<string>('DOCUMENT_AI_PROCESSOR_ID', '');
    const processorName = this.config.get<string>('DOCUMENT_AI_PROCESSOR_NAME', 'CareerBridgeOCR');

    if (!project || !processorId) {
      throw new Error(
        'Document AI is not configured. Set GCP_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID in apps/api/.env.',
      );
    }

    // Regional processors require a regional API endpoint (not the global client default).
    const apiEndpoint =
      location && location !== 'us' ? `${location}-documentai.googleapis.com` : undefined;

    const documentai = (await Function('return import("@google-cloud/documentai")')()) as {
      DocumentProcessorServiceClient: new (opts?: object) => {
        processDocument: (req: object) => Promise<
          [
            {
              document?: {
                text?: string | null;
                pages?: unknown[];
              };
            },
          ]
        >;
      };
    };

    const auth = gcpClientOptions(this.config, {
      projectIdFallback: project,
      allowFirebaseSa: true,
    });
    if (!(auth as { credentials?: unknown }).credentials) {
      this.logger.warn(
        'Document AI using Application Default Credentials (no valid service-account JSON loaded).',
      );
    }

    const client = new documentai.DocumentProcessorServiceClient({
      ...auth,
      apiEndpoint,
    });

    const name = `projects/${project}/locations/${location}/processors/${processorId}`;
    const [response] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: mimeType || 'application/pdf',
      },
    });

    const text = (response.document?.text || '').trim();
    const pageCount = Array.isArray(response.document?.pages)
      ? response.document!.pages!.length
      : undefined;

    return {
      text,
      extractor: 'document-ai',
      pageCount,
      notes: [
        `Extracted with Google Document AI (${processorName} / ${processorId}) in ${location}`,
      ],
    };
  }
}
