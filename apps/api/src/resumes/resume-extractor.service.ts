import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gcpClientOptions } from '../common/gcp/gcp-credentials';
import { sanitizeExtractedResumeText } from './layout-sanitize';

export type ResumeExtractionResult = {
  text: string;
  extractor: 'document-ai' | 'none';
  mimeType: string;
  fileName: string;
  pageCount?: number;
  confidence?: number;
  notes: string[];
  /** True when OCR-style extraction was used (images / scanned PDFs). */
  usedOcr?: boolean;
  layoutNotes?: string[];
};

function isUsableResumeText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters < 30) return false;
  const hasContactHint =
    /@/.test(t) ||
    /\b(education|experience|skills|project|summary|objective|qualification)\b/i.test(t) ||
    /\b\d{10}\b/.test(t.replace(/\D/g, ' '));
  return hasContactHint || t.length >= 120;
}

/** Document AI OCR / Form processors accept these content types. */
function toDocumentAiMime(mimeType: string, fileName: string): string | null {
  const lower = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (lower.includes('pdf') || name.endsWith('.pdf')) return 'application/pdf';
  if (lower.includes('png') || name.endsWith('.png')) return 'image/png';
  if (lower.includes('jpeg') || lower.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.includes('webp') || name.endsWith('.webp')) return 'image/webp';
  if (lower.includes('tiff') || name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff';
  if (lower.includes('gif') || name.endsWith('.gif')) return 'image/gif';
  if (lower.includes('bmp') || name.endsWith('.bmp')) return 'image/bmp';
  // Word formats are not accepted by Document AI OCR processors — ask for PDF.
  if (
    lower.includes('wordprocessingml') ||
    lower.includes('msword') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return null;
  }
  return null;
}

@Injectable()
export class ResumeExtractorService {
  private readonly logger = new Logger(ResumeExtractorService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Extract resume text via Google Document AI only (no pdf-parse / mammoth / local OCR).
   */
  async extract(buffer: Buffer, mimeType: string, fileName: string): Promise<ResumeExtractionResult> {
    const notes: string[] = [];
    const docMime = toDocumentAiMime(mimeType, fileName);

    if (!docMime) {
      notes.push(
        `Unsupported file for Document AI (${mimeType || fileName}). Upload a PDF or image (PNG/JPG).`,
      );
      return {
        text: '',
        extractor: 'none',
        mimeType,
        fileName,
        notes,
      };
    }

    const isImage = docMime.startsWith('image/');
    const docAi = await this.extractDocumentAi(buffer, docMime);
    notes.push(...docAi.notes);

    if (docAi.text.trim().length > 0) {
      const cleaned = sanitizeExtractedResumeText(docAi.text);
      const text = cleaned || docAi.text;
      if (cleaned && cleaned !== docAi.text) {
        notes.push('Applied layout sanitation (bullets/artifacts/orphaned roles)');
      }
      if (!isUsableResumeText(text)) {
        notes.push('Document AI returned text that looks thin — review the uploaded file quality');
      }
      return {
        ...docAi,
        text,
        mimeType,
        fileName,
        usedOcr: isImage || docMime === 'application/pdf',
        notes,
      };
    }

    notes.push('Document AI returned empty text');
    return {
      text: '',
      extractor: 'none',
      mimeType,
      fileName,
      notes,
    };
  }

  private async extractDocumentAi(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    const project =
      this.config.get<string>('GCP_PROJECT_ID', '') ||
      this.config.get<string>('FIREBASE_PROJECT_ID', '') ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      '';
    const location = this.config.get<string>('DOCUMENT_AI_LOCATION', 'asia-south1');
    const processorId = this.config.get<string>('DOCUMENT_AI_PROCESSOR_ID', '');
    if (!project || !processorId) {
      throw new ServiceUnavailableException({
        code: 'DOCUMENT_AI_NOT_CONFIGURED',
        message:
          'Resume extraction requires Google Document AI. Set GCP_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID.',
      });
    }

    try {
      const documentai = await import('@google-cloud/documentai');
      const clientOpts = gcpClientOptions(this.config, {
        projectIdFallback: project,
        allowFirebaseSa: false,
      });
      // Regional processors require the location-specific API endpoint.
      const client = new documentai.DocumentProcessorServiceClient({
        ...clientOpts,
        apiEndpoint: `${location}-documentai.googleapis.com`,
      });
      const name = `projects/${project}/locations/${location}/processors/${processorId}`;
      const [result] = await client.processDocument({
        name,
        rawDocument: {
          content: buffer.toString('base64'),
          mimeType: mimeType || 'application/pdf',
        },
      });
      const text = result.document?.text || '';
      this.logger.log(
        `Document AI extracted ${text.trim().length} chars (processor=${processorId}, location=${location})`,
      );
      return {
        text: text.trim(),
        extractor: 'document-ai',
        notes: ['Extracted with Google Document AI'],
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Document AI failed: ${msg}`);
      return {
        text: '',
        extractor: 'document-ai',
        notes: [`Document AI failed: ${msg}`],
      };
    }
  }
}
