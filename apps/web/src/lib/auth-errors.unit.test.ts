import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authErrorMessage } from '../../../web/src/lib/auth-errors';

describe('authErrorMessage', () => {
  it('maps captcha failure to a clear retry message', () => {
    const err = Object.assign(new Error('raw'), { code: 'auth/captcha-check-failed' });
    assert.match(authErrorMessage(err, 'request'), /could not be completed/i);
  });

  it('maps invalid OTP', () => {
    const err = Object.assign(new Error('raw'), { code: 'auth/invalid-verification-code' });
    assert.equal(authErrorMessage(err, 'verify'), 'The OTP is incorrect.');
  });

  it('maps expired OTP', () => {
    const err = Object.assign(new Error('raw'), { code: 'auth/code-expired' });
    assert.match(authErrorMessage(err, 'verify'), /expired/i);
  });

  it('surfaces ACCOUNT_EXISTS from API', () => {
    const err = Object.assign(new Error('This mobile number is already registered. Please login.'), {
      code: 'ACCOUNT_EXISTS',
    });
    assert.equal(authErrorMessage(err, 'request'), 'This mobile number is already registered. Please login.');
  });

  it('does not expose stack traces for unknown errors without message', () => {
    const msg = authErrorMessage({}, 'request');
    assert.doesNotMatch(msg, /stack|at Object|Error:/i);
  });
});
