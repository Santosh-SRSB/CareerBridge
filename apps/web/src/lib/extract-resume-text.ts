/**
 * Local PDF/DOCX text extraction is disabled.
 * Resume text comes from the Nest API: GCS → Google Document AI → LLM → profile.
 */
export async function extractResumeText(_file: File, _buffer: Buffer): Promise<string> {
  throw new Error(
    'Local resume extraction is disabled. Upload via POST /api/v1/resumes/upload-file (Document AI).',
  );
}
