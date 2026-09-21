import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Local HTML resume snapshots are disabled.
 * Resume files live in Google Cloud Storage and are viewed via signed URLs
 * from GET /api/v1/resumes/:id/view-url.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'SNAPSHOT_DISABLED',
        message:
          'Local HTML resume snapshots are no longer used. Upload a resume so it is stored in Cloud Storage.',
      },
    },
    { status: 410 },
  );
}
