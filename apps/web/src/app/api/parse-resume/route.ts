/**
 * Next.js proxy for POST /api/parse-resume → Nest /api/v1/parse-resume
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:3001/api/v1';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const auth = req.headers.get('authorization');
    const upstreamUrl = `${API_BASE.replace(/\/$/, '')}/parse-resume`;

    let body: BodyInit;
    const headers: Record<string, string> = {};
    if (auth) headers.authorization = auth;

    if (contentType.includes('multipart/form-data')) {
      // Forward FormData as-is (boundary preserved by undici when body is FormData)
      body = await req.formData();
    } else {
      headers['content-type'] = 'application/json';
      body = await req.text();
    }

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body,
    });

    const text = await upstream.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, error: text.slice(0, 500) };
    }

    return NextResponse.json(json, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'parse-resume proxy failed',
      },
      { status: 502 },
    );
  }
}
