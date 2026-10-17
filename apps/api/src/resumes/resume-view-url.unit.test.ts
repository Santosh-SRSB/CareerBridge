/**
 * Resume view URL: signed URL when the runtime can sign, owner-only inline copy when it cannot.
 *
 * Run: npm.cmd run test:resume -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readableResumeUrl, type ResumeObjectStore } from './resume-view-url.util';

const PATH = 'Resumes/user-a/cv.pdf';

function store(opts: { canSign: boolean; bytes?: Buffer | null }) {
  const calls: string[] = [];
  const s: ResumeObjectStore = {
    getSignedUrl: async (path, o) => {
      calls.push(`sign:${path}:${o.expiresInMinutes}`);
      if (!opts.canSign) throw new Error('Cannot sign data without `client_email`.');
      return `https://storage.googleapis.com/bucket/${path}?X-Goog-Signature=abc`;
    },
    downloadFile: async (path) => {
      calls.push(`download:${path}`);
      if (!opts.bytes) throw new Error('No such object');
      return opts.bytes;
    },
  };
  return { s, calls };
}

describe('readableResumeUrl', () => {
  it('returns a short-lived signed URL when signing works, without downloading the file', async () => {
    const { s, calls } = store({ canSign: true, bytes: Buffer.from('%PDF') });
    const r = await readableResumeUrl(s, PATH, 'application/pdf', 30);
    assert.equal(r.source, 'signed');
    assert.match(r.url, /X-Goog-Signature/);
    assert.deepEqual(calls, [`sign:${PATH}:30`]);
  });

  it('falls back to an inline copy of the same object when the runtime cannot sign (Cloud Run ADC)', async () => {
    const bytes = Buffer.from('%PDF-1.7 test');
    const { s, calls } = store({ canSign: false, bytes });
    const r = await readableResumeUrl(s, PATH, 'application/pdf', 30);
    assert.equal(r.source, 'inline');
    assert.equal(r.url, `data:application/pdf;base64,${bytes.toString('base64')}`);
    assert.deepEqual(calls, [`sign:${PATH}:30`, `download:${PATH}`]);
  });

  it('keeps the stored MIME type for non-PDF originals', async () => {
    const { s } = store({ canSign: false, bytes: Buffer.from('PK') });
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const r = await readableResumeUrl(s, 'Resumes/user-a/cv.docx', mime, 30);
    assert.ok(r.url.startsWith(`data:${mime};base64,`));
  });

  it('propagates the error when neither signing nor reading works (no public URL is invented)', async () => {
    const { s } = store({ canSign: false, bytes: null });
    await assert.rejects(() => readableResumeUrl(s, PATH, 'application/pdf', 30), /No such object/);
  });
});
