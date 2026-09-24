import { NextResponse } from "next/server";

/**
 * Local Next.js candidate create is disabled.
 * Use Nest API: POST /api/v1/candidates (and auth/onboarding flows).
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "LOCAL_CANDIDATES_DISABLED",
        message:
          "Candidate creation runs on the CareerBridge API. Use POST /api/v1/candidates after authentication.",
      },
    },
    { status: 410 },
  );
}
