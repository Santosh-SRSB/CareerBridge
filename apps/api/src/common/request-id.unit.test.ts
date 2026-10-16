import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { of, lastValueFrom } from 'rxjs';
import { BadRequestException } from '@nestjs/common';
import { resolveRequestId, sanitizePersistedRequestId } from './request-id';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

const VALID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('sanitizePersistedRequestId', () => {
  it('returns null when no correlation id was supplied', () => {
    assert.equal(sanitizePersistedRequestId(undefined), null);
    assert.equal(sanitizePersistedRequestId(null), null);
    assert.equal(sanitizePersistedRequestId(''), null);
    assert.equal(sanitizePersistedRequestId('   '), null);
  });

  it('accepts a valid UUID and rejects hostile values for persistence', () => {
    assert.equal(sanitizePersistedRequestId(VALID), VALID);
    const hostile = 'evil\ninject';
    const id = sanitizePersistedRequestId(hostile);
    assert.notEqual(id, hostile);
    assert.ok(id && !id.includes('\n'));
    assert.match(id!, /^[0-9a-f-]{36}$/i);
  });
});

describe('resolveRequestId', () => {
  it('generates a UUID when the client omits x-request-id', () => {
    const id = resolveRequestId(undefined);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('accepts a well-formed client UUID (case-normalized)', () => {
    assert.equal(resolveRequestId(VALID.toUpperCase()), VALID);
  });

  it('replaces malformed values with a server UUID', () => {
    const id = resolveRequestId('not-a-uuid');
    assert.notEqual(id, 'not-a-uuid');
    assert.match(id, /^[0-9a-f-]{36}$/i);
  });

  it('replaces excessively long values', () => {
    const long = `${VALID}${'a'.repeat(200)}`;
    const id = resolveRequestId(long);
    assert.notEqual(id, long);
    assert.equal(id.length, 36);
  });

  it('replaces CR/LF and multiline values so they cannot split logs', () => {
    const hostile = `${VALID}\r\nInjected: secret`;
    const id = resolveRequestId(hostile);
    assert.ok(!id.includes('\n') && !id.includes('\r'));
    assert.notEqual(id, hostile);
  });

  it('uses only the first value when the header is an array', () => {
    assert.equal(resolveRequestId([VALID, 'second']), VALID);
    const id = resolveRequestId(['bad', VALID]);
    assert.notEqual(id, 'bad');
    assert.notEqual(id, VALID);
  });
});

describe('RequestIdInterceptor trust boundary', () => {
  async function run(header: unknown) {
    const headers: Record<string, unknown> = {};
    if (header !== undefined) headers['x-request-id'] = header;
    let setHeaderValue: string | undefined;
    const request: { headers: Record<string, unknown>; requestId?: string } = { headers };
    const response = {
      setHeader: (_name: string, value: string) => {
        setHeaderValue = value;
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any;
    const body = await lastValueFrom(
      new RequestIdInterceptor().intercept(context, { handle: () => of({ ok: true }) }),
    );
    return { body, request, setHeaderValue };
  }

  it('sets a generated id on request, header, and body when missing', async () => {
    const { body, request, setHeaderValue } = await run(undefined);
    assert.equal(request.requestId, setHeaderValue);
    assert.equal((body as { requestId: string }).requestId, request.requestId);
    assert.match(request.requestId!, /^[0-9a-f-]{36}$/i);
  });

  it('echoes a valid client UUID', async () => {
    const { body, request, setHeaderValue } = await run(VALID);
    assert.equal(request.requestId, VALID);
    assert.equal(setHeaderValue, VALID);
    assert.equal((body as { requestId: string }).requestId, VALID);
  });

  it('does not echo a malformed client value', async () => {
    const { body, request, setHeaderValue } = await run(' spoof\nid ');
    assert.notEqual(request.requestId, ' spoof\nid ');
    assert.equal(setHeaderValue, request.requestId);
    assert.equal((body as { requestId: string }).requestId, request.requestId);
    assert.ok(!String(request.requestId).includes('\n'));
  });
});

describe('HttpExceptionFilter requestId', () => {
  it('prefers the sanitized request.requestId over a hostile raw header', () => {
    const filter = new HttpExceptionFilter();
    let statusCode = 0;
    let payload: { requestId?: string } = {};
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: { requestId?: string }) {
        payload = body;
        return body;
      },
    };
    const request = {
      headers: { 'x-request-id': 'evil\ninject' },
      requestId: VALID,
      method: 'GET',
      url: '/test',
    };
    filter.catch(new BadRequestException({ code: 'VALIDATION_ERROR', message: 'bad' }), {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any);
    assert.equal(statusCode, 400);
    assert.equal(payload.requestId, VALID);
  });

  it('sanitizes the header when request.requestId was never set', () => {
    const filter = new HttpExceptionFilter();
    let payload: { requestId?: string } = {};
    const response = {
      status() {
        return this;
      },
      json(body: { requestId?: string }) {
        payload = body;
        return body;
      },
    };
    filter.catch(new BadRequestException('bad'), {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-request-id': 'not-uuid' },
          method: 'GET',
          url: '/test',
        }),
        getResponse: () => response,
      }),
    } as any);
    assert.notEqual(payload.requestId, 'not-uuid');
    assert.match(payload.requestId!, /^[0-9a-f-]{36}$/i);
  });
});
