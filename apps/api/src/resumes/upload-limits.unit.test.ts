import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import multer from 'multer';

/**
 * Same call Nest's FileInterceptor makes: multer({ limits }).single(fieldName).
 * The 8 MB resume limit is reduced here so the test does not allocate 8 MB.
 */
function upload(fieldName: string, body: Buffer, fileSize = 64) {
  const boundary = '----careerbridge';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return new Promise<{ code?: string; message?: string; size?: number }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      multer({ limits: { fileSize } }).single('file')(req, res, (err: { code?: string; message?: string } | undefined) => {
        resolve({ code: err?.code, message: err?.message, size: (req as { file?: { size?: number } }).file?.size });
        res.end();
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('test server did not bind'));
        return;
      }
      const req = http.request(
        {
          host: '127.0.0.1',
          port: address.port,
          method: 'POST',
          headers: {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': String(payload.length),
          },
        },
        () => server.close(),
      );
      req.on('error', reject);
      req.end(payload);
    });
  });
}

describe('multer 2.4 resume upload contract', () => {
  it('accepts a small file on the file field and keeps the bytes', async () => {
    const result = await upload('file', Buffer.from('%PDF-1.4'));
    assert.equal(result.code, undefined);
    assert.equal(result.size, Buffer.from('%PDF-1.4').length);
  });

  it('rejects an oversized file with LIMIT_FILE_SIZE', async () => {
    const result = await upload('file', Buffer.alloc(80, 1), 32);
    assert.equal(result.code, 'LIMIT_FILE_SIZE');
    assert.equal(result.message, 'File too large');
  });

  it('rejects a file sent under a different field name', async () => {
    const result = await upload('avatar', Buffer.from('%PDF-1.4'));
    assert.equal(result.code, 'LIMIT_UNEXPECTED_FILE');
    assert.match(result.message || '', /unexpected/i);
  });
});
