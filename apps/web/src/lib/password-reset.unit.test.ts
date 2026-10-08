/**
 * Forgot password, client side: the real resetPassword() → request() path with only `fetch` stubbed.
 * Response bodies are the exact JSON the API sends (pinned by the HTTP tests in apps/api auth.service.unit.test.ts).
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { afterEach, before, describe, it } from 'node:test';

const API = 'http://api.test/api/v1';
const MESSAGE = 'Password updated. You can sign in now.';

/** POST /api/v1/auth/password/reset → 201, as served by the API in this tree. */
const RESET_OK_BODY = { success: true, data: { message: MESSAGE }, requestId: 'req-1' };
/** The same endpoint as served by DEV commit f90136d: `success` at the top level made the interceptor skip `data`. */
const DEPLOYED_F90136D_BODY = { success: true, message: MESSAGE, requestId: 'req-1' };

type Lib = typeof import('./password-reset') & typeof import('./api') & typeof import('./auth-errors');
let lib: Lib;
const realFetch = globalThis.fetch;
const sent: Array<{ url: string; init: RequestInit }> = [];

function serve(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const payload = (accountType: 'CANDIDATE' | 'EMPLOYER') => ({
  requestId: 'otp-request-1',
  otp: '123456',
  accountType,
  password: 'NewPass@456',
});

before(async () => {
  process.env.NEXT_PUBLIC_API_URL = API;
  // api.ts → session.ts imports through the Next.js `@/` alias, which plain Node does not know.
  const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
  const resolve = loader._resolveFilename;
  const webSrc = path.resolve(__dirname, '..');
  loader._resolveFilename = (request, ...rest) =>
    resolve(request.startsWith('@/') ? path.join(webSrc, request.slice(2)) : request, ...rest);
  lib = { ...(await import('./api')), ...(await import('./password-reset')), ...(await import('./auth-errors')) };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  sent.length = 0;
});

describe('Forgot password: successful reset', () => {
  for (const accountType of ['CANDIDATE', 'EMPLOYER'] as const) {
    it(`${accountType}: resetPassword() returns { message } and posts exactly the DTO fields`, async () => {
      serve(201, RESET_OK_BODY);
      const result = await lib.resetPassword(payload(accountType));
      assert.deepEqual(result, { message: MESSAGE });
      assert.equal(sent[0].url, `${API}/auth/password/reset`);
      assert.equal(sent[0].init.method, 'POST');
      assert.deepEqual(JSON.parse(String(sent[0].init.body)), payload(accountType));
    });

    it(`${accountType}: the page's success step resolves to the sign-in notice URL`, async () => {
      serve(201, RESET_OK_BODY);
      assert.equal(
        await lib.submitPasswordReset(payload(accountType)),
        `/login?role=${accountType.toLowerCase()}&reset=1`,
      );
    });
  }

  it('reproduces the DEV crash: the f90136d body leaves resetPassword() undefined, so `.message` throws', async () => {
    serve(201, DEPLOYED_F90136D_BODY);
    const result = await lib.resetPassword(payload('CANDIDATE'));
    assert.equal(result, undefined);
    assert.throws(
      () => (result as unknown as { message: string }).message,
      new TypeError("Cannot read properties of undefined (reading 'message')"),
    );
  });

  it('a completed reset never becomes "Cannot read properties of undefined", whatever the 2xx body holds', async () => {
    for (const body of [RESET_OK_BODY, DEPLOYED_F90136D_BODY, { success: true, requestId: 'req-1' }]) {
      serve(201, body);
      assert.equal(await lib.submitPasswordReset(payload('EMPLOYER')), '/login?role=employer&reset=1');
    }
  });
});

describe('Forgot password: rejected resets show friendly messages', () => {
  const failure = (code: string, message: string) => ({ success: false, error: { code, message }, requestId: 'req-2' });

  async function shownFor(body: unknown) {
    serve(400, body);
    const err = await lib.submitPasswordReset(payload('CANDIDATE')).then(
      () => assert.fail('reset should be rejected'),
      (e: unknown) => e,
    );
    return lib.authErrorMessage(err, 'reset');
  }

  it('wrong OTP', async () => {
    assert.equal(await shownFor(failure('INVALID_OTP', 'Verification rejected')), lib.INVALID_OTP_MESSAGE);
  });

  it('already-used OTP', async () => {
    const used = failure('INVALID_OTP', 'This code has already been used. Please request a new OTP.');
    assert.equal(await shownFor(used), lib.INVALID_OTP_MESSAGE);
  });

  it('expired OTP', async () => {
    const expired = failure('OTP_EXPIRED', 'OTP has expired. Please click Resend OTP.');
    assert.equal(await shownFor(expired), lib.RESET_OTP_EXPIRED_MESSAGE);
  });

  it('raw validation errors are hidden', async () => {
    const shown = await shownFor(failure('VALIDATION_ERROR', 'property role should not exist'));
    assert.doesNotMatch(shown, /property|should not exist/i);
  });
});
