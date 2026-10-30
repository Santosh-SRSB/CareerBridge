import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { setCookieConsent } from './cookie-consent';
import {
  __resetMetaPixelForTests,
  canUseMetaPixel,
  ensureMetaPixelLoaded,
  isMetaPixelAllowlisted,
  revokeMetaPixelConsent,
  trackMetaCompleteRegistration,
  trackMetaLead,
  trackMetaPageView,
} from './meta-pixel';

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

describe('consent withdrawal blocks Meta tracking', () => {
  const originalEnv = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const calls: unknown[][] = [];

  afterEach(() => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = originalEnv;
    __resetMetaPixelForTests();
    calls.length = 0;
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  function mockWindowWithConsent(value: 'accepted' | 'rejected') {
    const store: Record<string, string> = {
      cb_cookie_consent_v1: value,
    };
    const fbq = (...args: unknown[]) => {
      calls.push(args);
    };
    // @ts-expect-error jsdom-less unit harness
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => {
          store[key] = val;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
      fbq,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      document: {
        createElement: () => ({ async: false, src: '' }),
        getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
      },
    };
    return store;
  }

  it('stops PageView and conversions immediately after Reject, and does not re-enable until Accept', () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = '1356370663141517';
    const store = mockWindowWithConsent('accepted');

    assert.equal(ensureMetaPixelLoaded(), true);
    trackMetaPageView('/');
    trackMetaCompleteRegistration('candidate', 'otp-1');
    trackMetaLead('demo-1');
    assert.ok(calls.some((c) => c[0] === 'track' && c[1] === 'PageView'));
    assert.ok(calls.some((c) => c[0] === 'track' && c[1] === 'CompleteRegistration'));
    assert.ok(calls.some((c) => c[0] === 'track' && c[1] === 'Lead'));

    // Withdraw consent (Reject).
    store.cb_cookie_consent_v1 = 'rejected';
    setCookieConsent('rejected');
    revokeMetaPixelConsent();
    calls.length = 0;

    assert.equal(canUseMetaPixel('/'), false);
    assert.equal(ensureMetaPixelLoaded(), false);
    trackMetaPageView('/');
    trackMetaCompleteRegistration('candidate', 'otp-2');
    trackMetaLead('demo-2');

    const trackingCalls = calls.filter((c) => c[0] === 'track');
    assert.equal(trackingCalls.length, 0, 'no track events after Reject');
    assert.ok(
      calls.every((c) => c[0] === 'consent' || c[0] !== 'init'),
      'Pixel must not init again while rejected',
    );

    // Accept again — tracking can resume.
    store.cb_cookie_consent_v1 = 'accepted';
    setCookieConsent('accepted');
    assert.equal(ensureMetaPixelLoaded(), true);
    trackMetaPageView('/register');
    assert.ok(calls.some((c) => c[0] === 'track' && c[1] === 'PageView'));
  });
});
