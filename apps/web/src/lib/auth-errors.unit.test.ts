import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OTP_EXPIRED_MESSAGE } from '@careerbridge/shared';
import {
  INVALID_OTP_MESSAGE,
  RESET_OTP_EXPIRED_MESSAGE,
  authErrorMessage,
  isRawValidationMessage,
} from '../../../web/src/lib/auth-errors';

const apiError = (message: string, code: string, status = 400) => Object.assign(new Error(message), { code, status });

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

describe('authErrorMessage: forgot password and OTP verification', () => {
  it('an incorrect or already-used OTP from the API gets the friendly message on both verify forms', () => {
    for (const raw of ['Verification rejected', 'This code has already been used. Please request a new OTP.']) {
      assert.equal(authErrorMessage(apiError(raw, 'INVALID_OTP'), 'reset'), INVALID_OTP_MESSAGE);
      assert.equal(authErrorMessage(apiError(raw, 'INVALID_OTP'), 'verify'), INVALID_OTP_MESSAGE);
    }
    assert.equal(INVALID_OTP_MESSAGE, 'Invalid or expired OTP. Please enter the latest OTP or request a new one.');
  });

  it('an expired OTP says so, and on the reset form points to "Send a new code"', () => {
    const err = apiError(OTP_EXPIRED_MESSAGE, 'OTP_EXPIRED');
    assert.equal(authErrorMessage(err, 'reset'), RESET_OTP_EXPIRED_MESSAGE);
    assert.match(RESET_OTP_EXPIRED_MESSAGE, /expired/i);
    assert.match(RESET_OTP_EXPIRED_MESSAGE, /Send a new code/);
    assert.equal(authErrorMessage(err, 'verify'), OTP_EXPIRED_MESSAGE);
  });

  it('raw class-validator messages are never shown', () => {
    const raws = [
      'property replacesRequestId should not exist',
      'property role should not exist',
      'otp must be a string',
      'requestId must be longer than or equal to 8 characters',
      'accountType must be one of the following values: CANDIDATE, EMPLOYER',
      'otp should not be empty',
    ];
    for (const raw of raws) {
      assert.ok(isRawValidationMessage(raw), raw);
      for (const stage of ['request', 'verify', 'reset'] as const) {
        const shown = authErrorMessage(apiError(raw, 'VALIDATION_ERROR'), stage);
        assert.notEqual(shown, raw);
        assert.doesNotMatch(shown, /property|must be|should not/i);
      }
    }
  });

  it('a client runtime fault (the old reset-response crash) is not shown raw', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'message')");
    const shown = authErrorMessage(err, 'reset');
    assert.doesNotMatch(shown, /properties|undefined|reading/i);
    assert.match(shown, /reset your password/i);
  });

  it('messages written for users still come through', () => {
    const password =
      'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';
    assert.equal(authErrorMessage(apiError(password, 'VALIDATION_ERROR'), 'reset'), password);
    assert.equal(authErrorMessage(apiError('Enter a valid email address.', 'VALIDATION_ERROR'), 'request'), 'Enter a valid email address.');
    const notFound = 'No employer account found for this email. Register as an employer first.';
    assert.equal(authErrorMessage(apiError(notFound, 'ACCOUNT_NOT_FOUND', 404), 'request'), notFound);
    const local = 'Mobile OTP is not available right now. Please try Email OTP or try again later.';
    assert.equal(authErrorMessage(new Error(local), 'request'), local);
  });

  it('too many attempts keeps its stage-specific wording', () => {
    const err = apiError('raw', 'TOO_MANY_ATTEMPTS', 429);
    assert.match(authErrorMessage(err, 'request'), /try again later/);
    assert.match(authErrorMessage(err, 'verify'), /request a new OTP/);
    assert.match(authErrorMessage(err, 'reset'), /request a new OTP/);
  });
});
