import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      html?: string;
      fileName?: string;
    };
    const userId = String(body.userId || '').trim();
    const html = String(body.html || '');
    if (!userId || !html) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId and html are required.' } },
        { status: 400 },
      );
    }

    const dir = path.join(process.cwd(), 'public', 'candidate-resumes');
    await mkdir(dir, { recursive: true });
    const fileName = safeName(body.fileName || `${userId}.html`);
    const finalName = fileName.toLowerCase().endsWith('.html') ? fileName : `${fileName}.html`;
    const diskName = `${safeName(userId)}-${finalName}`;
    const fullPath = path.join(dir, diskName);
    await writeFile(fullPath, html, 'utf8');

    const publicPath = `/candidate-resumes/${diskName}`;
    return NextResponse.json({
      success: true,
      data: { path: publicPath },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Could not save resume snapshot.',
        },
      },
      { status: 500 },
    );
  }
}
