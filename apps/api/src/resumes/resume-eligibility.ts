import type { Prisma } from '../prisma/client';

/** Non-archived resumes whose content is trustworthy (builder resumes, or uploads that parsed successfully). */
export const USABLE_RESUME_WHERE = {
  archivedAt: null,
  OR: [{ processingStatus: null }, { processingStatus: { notIn: ['FAILED', 'PENDING', 'PROCESSING'] } }],
} satisfies Prisma.ResumeWhereInput;

export const EXTRACTION_FAILED_MESSAGE = 'Could not extract text from the resume. Try a clearer PDF or DOCX.';
const STORAGE_FAILED_MESSAGE = 'We could not store your resume file. Please upload it again.';
const GENERIC_PROCESSING_FAILED_MESSAGE = 'We could not process this resume. Please retry or upload the file again.';

/**
 * Stored processing errors can carry raw database/storage/provider messages; candidates only ever
 * see one of these fixed messages.
 */
export function publicProcessingError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith(EXTRACTION_FAILED_MESSAGE) || raw.startsWith('Text extraction failed')) {
    return EXTRACTION_FAILED_MESSAGE;
  }
  if (raw.startsWith('Upload to storage failed')) return STORAGE_FAILED_MESSAGE;
  return GENERIC_PROCESSING_FAILED_MESSAGE;
}
