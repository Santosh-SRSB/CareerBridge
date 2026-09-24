/**
 * Next.js proxy for POST /api/parse-resume → Nest /api/v1/parse-resume
 */
import { NextRequest, NextResponse } from 'next/server';

function resolveApiBase(): string {
  const fromEnv = (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== 'production') {
    return 'http://127.0.0.1:3001/api/v1';
  }
  return '';
}

const API_BASE = resolveApiBase();

export async function POST(req: NextRequest) {
  try {
    if (!API_BASE) {
      return NextResponse.json(
        {
          success: false,
          error:
            'API_INTERNAL_URL or NEXT_PUBLIC_API_URL must be set in the deployed environment.',
        },
        { status: 500 },
      );
    }
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
