import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMetaPixelAllowlisted } from './meta-pixel';

describe('isMetaPixelAllowlisted', () => {
  it('allows only the agreed Meta Pixel routes', () => {
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
    ]) {
      assert.equal(isMetaPixelAllowlisted(path), true, path);
    }
  });

  it('rejects login and private product routes', () => {
    for (const path of ['/login', '/dashboard', '/employer/jobs', '/jobs', '/passport']) {
      assert.equal(isMetaPixelAllowlisted(path), false, path);
    }
  });

  it('ignores query strings when matching', () => {
    assert.equal(isMetaPixelAllowlisted('/register?role=candidate'), true);
    assert.equal(isMetaPixelAllowlisted('/dashboard?x=1'), false);
  });
});
