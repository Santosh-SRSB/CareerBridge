import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Local pdf-parse / mammoth / heuristic parsing is disabled.
 * Use the Nest API upload pipeline: GCS → Document AI → LLM → validate → profile.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'LOCAL_PARSE_DISABLED',
        message:
          'Resume parsing runs on the API with Google Document AI. Use upload-file (POST /api/v1/resumes/upload-file).',
      },
    },
    { status: 410 },
  );
}
