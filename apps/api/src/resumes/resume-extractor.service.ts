import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { reconstructReadingOrder, stripInternalPageMarkers } from './pdf-reading-order';
import { sanitizeExtractedResumeText } from './layout-sanitize';

export type ResumeExtractionResult = {
  text: string;
  extractor: 'pdf-parse' | 'mammoth' | 'tesseract' | 'document-ai' | 'none';
  mimeType: string;
  fileName: string;
  pageCount?: number;
  confidence?: number;
  notes: string[];
  /** True when OCR was used (lower confidence downstream). */
  usedOcr?: boolean;
  layoutNotes?: string[];
};

function isUsableResumeText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;
  // Scanned PDFs sometimes yield garbage glyphs with almost no letters.
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters < 30) return false;
  const hasContactHint =
    /@/.test(t) ||
    /\b(education|experience|skills|project|summary|objective|qualification)\b/i.test(t) ||
    /\b\d{10}\b/.test(t.replace(/\D/g, ' '));
  return hasContactHint || t.length >= 120;
}

@Injectable()
export class ResumeExtractorService {
  private readonly logger = new Logger(ResumeExtractorService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(buffer: Buffer, mimeType: string, fileName: string): Promise<ResumeExtractionResult> {
    const notes: string[] = [];
    const lower = (mimeType || '').toLowerCase();
    const name = (fileName || '').toLowerCase();

    const isPdf = lower.includes('pdf') || name.endsWith('.pdf');
    const isDocx =
      lower.includes('wordprocessingml') ||
      lower.includes('msword') ||
      name.endsWith('.docx') ||
      name.endsWith('.doc');
    const isImage =
      lower.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg');

    // Filename is metadata only — never used as parse evidence for content.
    void name;

    const finalize = (result: ResumeExtractionResult): ResumeExtractionResult => {
      if (!result.text?.trim()) return result;
      const cleaned = sanitizeExtractedResumeText(result.text);
      return {
        ...result,
        text: cleaned || result.text,
        notes: cleaned && cleaned !== result.text
          ? [...result.notes, 'Applied layout sanitation (bullets/artifacts/orphaned roles)']
          : result.notes,
      };
    };

    if (isPdf) {
      const pdfResult = await this.extractPdf(buffer);
      if (isUsableResumeText(pdfResult.text)) {
        return finalize({ ...pdfResult, mimeType, fileName, notes: [...notes, ...pdfResult.notes] });
      }
      notes.push(
        ...(pdfResult.notes.length ? pdfResult.notes : ['PDF text layer empty or unusable']),
        'Attempting OCR via page screenshots (Tesseract cannot read PDF bytes directly)',
      );
      const ocrPdf = await this.extractPdfViaOcrScreenshots(buffer);
      if (isUsableResumeText(ocrPdf.text)) {
        return finalize({
          ...ocrPdf,
          mimeType,
          fileName,
          usedOcr: true,
          confidence: Math.min(ocrPdf.confidence ?? 0.55, 0.7),
          notes: [...notes, ...ocrPdf.notes],
        });
      }
      notes.push(...ocrPdf.notes);
    } else if (isDocx) {
      const doc = await this.extractDocx(buffer);
      if (isUsableResumeText(doc.text) || doc.text.trim().length >= 40) {
        return finalize({ ...doc, mimeType, fileName, notes });
      }
      notes.push('DOC/DOCX extraction returned little text');
    } else if (isImage) {
      const ocr = await this.extractOcr(buffer);
      if (isUsableResumeText(ocr.text) || ocr.text.trim().length >= 40) {
        return finalize({
          ...ocr,
          mimeType,
          fileName,
          usedOcr: true,
          notes: [...notes, ...ocr.notes],
        });
      }
      notes.push(...ocr.notes);
    } else {
      notes.push(`Unsupported mime for primary extractors: ${mimeType}`);
    }

    const docAi = await this.extractDocumentAi(buffer, mimeType);
    if (docAi.text.trim().length > 0) {
      return finalize({ ...docAi, mimeType, fileName, notes: [...notes, ...docAi.notes] });
    }

    notes.push('All extractors failed or returned empty text');
    return {
      text: '',
      extractor: 'none',
      mimeType,
      fileName,
      notes,
    };
  }

  private async extractPdf(buffer: Buffer): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    try {
      // pdf-parse v2 exports a PDFParse class, not a callable function.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('pdf-parse') as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getText: (params?: object) => Promise<{
            text?: string;
            total?: number;
            pages?: Array<{ num: number; text: string }>;
          }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
      try {
        const parsed = await parser.getText({
          lineEnforce: true,
          cellSeparator: '\t',
          cellThreshold: 12,
          lineThreshold: 4.6,
          // Disable default page joiner noise; we rebuild order ourselves.
          pageJoiner: '',
        });
        const pages = Array.isArray(parsed.pages) && parsed.pages.length
          ? parsed.pages
          : [{ num: 1, text: parsed.text || '' }];
        const ordered = reconstructReadingOrder(pages);
        const text = stripInternalPageMarkers(ordered.text);
        return {
          text,
          extractor: 'pdf-parse',
          pageCount: parsed.total || pages.length,
          notes: ['Extracted with pdf-parse (layout-aware reading order)', ...ordered.notes],
          layoutNotes: ordered.notes,
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(`pdf-parse failed: ${(err as Error).message}`);
      return { text: '', extractor: 'pdf-parse', notes: [`pdf-parse failed: ${(err as Error).message}`] };
    }
  }

  /** Render PDF pages to images, then OCR — used only when text layer is unusable. */
  private async extractPdfViaOcrScreenshots(
    buffer: Buffer,
  ): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('pdf-parse') as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getScreenshot: (params?: object) => Promise<{
            pages?: Array<{ data?: Buffer; pageNumber?: number; num?: number }>;
          }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
      try {
        const shot = await parser.getScreenshot({
          scale: 1.5,
          imageBuffer: true,
          imageDataUrl: false,
          first: 4, // cap cost on long scanned docs
        });
        const pages = shot.pages || [];
        if (!pages.length) {
          return { text: '', extractor: 'tesseract', notes: ['PDF screenshot OCR: no pages rendered'] };
        }
        const chunks: string[] = [];
        let confSum = 0;
        let confN = 0;
        for (let i = 0; i < pages.length; i += 1) {
          const data = pages[i]?.data;
          if (!data || !Buffer.isBuffer(data)) continue;
          const ocr = await this.extractOcr(data);
          if (ocr.text.trim()) {
            chunks.push(`-- page ${pages[i].pageNumber || pages[i].num || i + 1} --\n${ocr.text.trim()}`);
          }
          if (typeof ocr.confidence === 'number') {
            confSum += ocr.confidence;
            confN += 1;
          }
        }
        const text = stripInternalPageMarkers(chunks.join('\n\n'));
        return {
          text,
          extractor: 'tesseract',
          pageCount: pages.length,
          confidence: confN ? confSum / confN / 100 : 0.5,
          notes: [`OCR via pdf-parse screenshots + tesseract (${pages.length} page(s))`],
          usedOcr: true,
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(`PDF screenshot OCR failed: ${(err as Error).message}`);
      return {
        text: '',
        extractor: 'tesseract',
        notes: [`PDF screenshot OCR failed: ${(err as Error).message}`],
      };
    }
  }

  private async extractDocx(buffer: Buffer): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: (result.value || '').trim(),
        extractor: 'mammoth',
        notes: ['Extracted with mammoth'],
      };
    } catch (err) {
      this.logger.warn(`mammoth failed: ${(err as Error).message}`);
      return { text: '', extractor: 'mammoth', notes: [`mammoth failed: ${(err as Error).message}`] };
    }
  }

  private async extractOcr(buffer: Buffer): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(buffer, 'eng');
      return {
        text: (result.data.text || '').trim(),
        extractor: 'tesseract',
        confidence: result.data.confidence,
        notes: ['Extracted with tesseract OCR'],
        usedOcr: true,
      };
    } catch (err) {
      this.logger.warn(`tesseract failed: ${(err as Error).message}`);
      return { text: '', extractor: 'tesseract', notes: [`tesseract failed: ${(err as Error).message}`] };
    }
  }

  /** Optional Google Document AI fallback when configured. */
  private async extractDocumentAi(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Omit<ResumeExtractionResult, 'mimeType' | 'fileName'>> {
    const project = this.config.get<string>('GCP_PROJECT_ID', '');
    const location = this.config.get<string>('DOCUMENT_AI_LOCATION', 'us');
    const processorId = this.config.get<string>('DOCUMENT_AI_PROCESSOR_ID', '');
    if (!project || !processorId) {
      return {
        text: '',
        extractor: 'document-ai',
        notes: ['Document AI skipped (DOCUMENT_AI_PROCESSOR_ID not set)'],
      };
    }

    try {
      // Optional dependency — only used when DOCUMENT_AI_PROCESSOR_ID is configured.
      const documentai = (await Function('return import("@google-cloud/documentai")')()) as {
        DocumentProcessorServiceClient: new (opts?: object) => {
          processDocument: (req: object) => Promise<[{ document?: { text?: string | null } }]>;
        };
      };
      const client = new documentai.DocumentProcessorServiceClient({
        projectId: project,
        keyFilename: this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') || undefined,
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
      return {
        text: text.trim(),
        extractor: 'document-ai',
        notes: ['Extracted with Google Document AI fallback'],
      };
    } catch (err) {
      this.logger.warn(`Document AI failed: ${(err as Error).message}`);
      return {
        text: '',
        extractor: 'document-ai',
        notes: [`Document AI failed: ${(err as Error).message}`],
      };
    }
  }
}
