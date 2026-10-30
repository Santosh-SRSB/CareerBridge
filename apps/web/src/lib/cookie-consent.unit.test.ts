import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublicConsentPath } from './cookie-consent';

describe('isPublicConsentPath', () => {
  it('allows marketing, legal, registration and OTP pages', () => {
    for (const path of [
      '/',
      '/welcome',
      '/employer/welcome',
      '/support',
      '/privacy',
      '/terms',
      '/testimonials',
      '/register',
      '/employer/register',
      '/verify-otp',
      '/login',
      '/login/password',
      '/employer/terms',
    ]) {
      assert.equal(isPublicConsentPath(path), true, path);
    }
  });

  it('blocks private candidate and employer product areas', () => {
    for (const path of [
      '/dashboard',
      '/passport',
      '/resume',
      '/resumes',
      '/applications',
      '/profile',
      '/onboarding',
      '/interviews',
      '/jobs',
      '/jobs/abc',
      '/employer',
      '/employer/jobs',
      '/employer/candidates',
      '/adminsrsb',
      '/notifications',
    ]) {
      assert.equal(isPublicConsentPath(path), false, path);
    }
  });
});
