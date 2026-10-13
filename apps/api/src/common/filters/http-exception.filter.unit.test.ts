import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpExceptionFilter } from './http-exception.filter';

function capture(exception: unknown) {
  const body: { status?: number; json?: unknown } = {};
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status(code: number) {
          body.status = code;
          return this;
        },
        json(payload: unknown) {
          body.json = payload;
        },
      }),
      getRequest: () => ({
        headers: { 'x-request-id': 'req-test' },
        method: 'POST',
        originalUrl: '/api/v1/resumes/upload-file',
      }),
    }),
  };
  new HttpExceptionFilter().catch(exception, host as never);
  return body;
}

describe('upload error mapping', () => {
  it('returns 413 for a multer file-size error without treating it as a server fault', () => {
    const body = capture(Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }));
    assert.equal(body.status, 413);
    const json = body.json as { error: { code: string; message: string } };
    assert.equal(json.error.code, 'VALIDATION_ERROR');
    assert.equal(json.error.message, 'File too large');
  });

  it('returns 400 for an unexpected file field from multer 2.4', () => {
    const body = capture(
      Object.assign(new Error('Unexpected file field'), { code: 'LIMIT_UNEXPECTED_FILE', field: 'avatar' }),
    );
    assert.equal(body.status, 400);
    const json = body.json as { error: { message: string } };
    assert.equal(json.error.message, 'Unexpected file field');
  });

  it('does not treat a database unique-constraint error as an upload rejection', () => {
    const body = capture(Object.assign(new Error('unique'), { code: 'P2002' }));
    assert.equal(body.status, 409);
  });
});
