import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ResumeExtractionResult = {
  text: string;
  extractor: 'pdf-parse' | 'mammoth' | 'tesseract' | 'document-ai' | 'none';
  mimeType: string;
  fileName: string;
  pageCount?: number;
  confidence?: number;
  notes: string[];
};

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

    if (isPdf) {
      const pdfResult = await this.extractPdf(buffer);
      if (pdfResult.text.trim().length >= 20) {
        return { ...pdfResult, mimeType, fileName, notes };
      }
      notes.push(
        pdfResult.notes.join('; ') || 'PDF text layer empty or short',
        'Skipping Tesseract OCR for PDF (it cannot read PDF bytes and crashes the Node process)',
      );
    } else if (isDocx) {
      const doc = await this.extractDocx(buffer);
      if (doc.text.trim().length >= 40) {
        return { ...doc, mimeType, fileName, notes };
      }
      notes.push('DOC/DOCX extraction returned little text');
    } else if (isImage) {
      const ocr = await this.extractOcr(buffer);
      if (ocr.text.trim().length >= 40) {
        return { ...ocr, mimeType, fileName, notes: [...notes, ...ocr.notes] };
      }
      notes.push(...ocr.notes);
    } else {
      notes.push(`Unsupported mime for primary extractors: ${mimeType}`);
    }

    const docAi = await this.extractDocumentAi(buffer, mimeType);
    if (docAi.text.trim().length > 0) {
      return { ...docAi, mimeType, fileName, notes: [...notes, ...docAi.notes] };
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
          getText: () => Promise<{ text?: string; total?: number }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
      try {
        const parsed = await parser.getText();
        return {
          text: (parsed.text || '').trim(),
          extractor: 'pdf-parse',
          pageCount: parsed.total,
          notes: ['Extracted with pdf-parse'],
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(`pdf-parse failed: ${(err as Error).message}`);
      return { text: '', extractor: 'pdf-parse', notes: [`pdf-parse failed: ${(err as Error).message}`] };
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
