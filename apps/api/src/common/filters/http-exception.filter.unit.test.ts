/**
 * SEC-LOG-002 — client error JSON does not leak stacks/internals.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function hostWith(statusCapture: { status?: number; body?: unknown }, requestId = 'req-test-1') {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status(code: number) {
          statusCapture.status = code;
          return {
            json(body: unknown) {
              statusCapture.body = body;
            },
          };
        },
      }),
      getRequest: () => ({
        headers: { 'x-request-id': requestId },
        requestId,
        method: 'GET',
        url: '/api/v1/probe',
        originalUrl: '/api/v1/probe',
      }),
    }),
  } as never;
}

describe('SEC-LOG-002 HttpExceptionFilter client error shape', () => {
  it('returns success:false with code/message/requestId and no stack for 4xx', () => {
    const out: { status?: number; body?: any } = {};
    new HttpExceptionFilter().catch(
      new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bad field' }),
      hostWith(out),
    );
    assert.equal(out.status, 400);
    assert.equal(out.body.success, false);
    assert.equal(out.body.error.code, 'VALIDATION_ERROR');
    assert.equal(out.body.error.message, 'Bad field');
    assert.ok(typeof out.body.requestId === 'string' && out.body.requestId.length > 0);
    assert.equal('stack' in out.body, false);
    assert.equal(JSON.stringify(out.body).includes('\n    at '), false);
  });

  it('scrubs 5xx message to a generic client string and keeps requestId', () => {
    const out: { status?: number; body?: any } = {};
    const err = new HttpException(
      { code: 'INTERNAL_ERROR', message: 'PrismaClientKnownRequestError: secret details' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    new HttpExceptionFilter().catch(err, hostWith(out));
    assert.equal(out.status, 500);
    assert.equal(out.body.success, false);
    assert.equal(out.body.error.message, 'Something went wrong. Please try again.');
    assert.ok(typeof out.body.requestId === 'string' && out.body.requestId.length > 0);
    assert.equal(String(out.body.error.message).includes('Prisma'), false);
    assert.equal(String(out.body.error.message).includes('secret'), false);
  });

  it('unexpected Error becomes generic 500 without stack in JSON', () => {
    const out: { status?: number; body?: any } = {};
    new HttpExceptionFilter().catch(new Error('boom stack should stay server-side'), hostWith(out));
    assert.equal(out.status, 500);
    assert.equal(out.body.success, false);
    assert.equal(out.body.error.message, 'Something went wrong. Please try again.');
    assert.equal(JSON.stringify(out.body).includes('boom'), false);
  });
});
