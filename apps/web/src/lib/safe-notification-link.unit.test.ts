import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SAFE_NOTIFICATION_LINK_SW_SOURCE,
  jobInviteApplyHref,
  safeNotificationLink,
} from './safe-notification-link';

describe('SEC-FE-008 safeNotificationLink', () => {
  it('allows same-origin relative paths', () => {
    assert.equal(safeNotificationLink('/notifications'), '/notifications');
    assert.equal(safeNotificationLink('/applications/APP1'), '/applications/APP1');
    assert.equal(safeNotificationLink('  /dashboard  '), '/dashboard');
  });

  it('rejects absolute, protocol-relative, backslash and scheme-bearing links', () => {
    assert.equal(safeNotificationLink('https://evil.example/phish'), '/notifications');
    assert.equal(safeNotificationLink('//evil.example/phish'), '/notifications');
    assert.equal(safeNotificationLink('javascript:alert(1)'), '/notifications');
    assert.equal(safeNotificationLink('data:text/html,hi'), '/notifications');
    assert.equal(safeNotificationLink('/\\evil'), '/notifications');
    assert.equal(safeNotificationLink('/javascript:alert(1)'), '/notifications');
    assert.equal(safeNotificationLink('/http://evil.example'), '/notifications');
    assert.equal(safeNotificationLink(''), '/notifications');
    assert.equal(safeNotificationLink(null), '/notifications');
  });

  it('SW-embedded source matches TS helper decisions for unsafe and safe inputs', () => {
    // Evaluate the same ES5 function the service worker embeds.
    const fn = new Function(`${SAFE_NOTIFICATION_LINK_SW_SOURCE}; return safeNotificationLink;`)() as (
      link: unknown,
      fallback?: string,
    ) => string;
    const samples: unknown[] = [
      '/notifications',
      '/applications/APP1',
      'https://evil.example/x',
      '//evil.example/x',
      'javascript:alert(1)',
      '/javascript:alert(1)',
      '/\\evil',
      '',
      null,
      42,
    ];
    for (const sample of samples) {
      assert.equal(fn(sample, '/notifications'), safeNotificationLink(sample), String(sample));
    }
  });

  it('exposes Apply only for employer job invites to /jobs/…', () => {
    assert.equal(jobInviteApplyHref({ type: 'JOB_INVITE', link: '/jobs/abc' }), '/jobs/abc');
    assert.equal(jobInviteApplyHref({ type: 'JOB_INVITE', link: '/jobs/abc/apply' }), '/jobs/abc/apply');
    assert.equal(jobInviteApplyHref({ type: 'JOB_MATCH', link: '/jobs/abc' }), null);
    assert.equal(jobInviteApplyHref({ type: 'JOB_INVITE', link: 'https://evil.example/jobs/x' }), null);
    assert.equal(jobInviteApplyHref({ type: 'JOB_INVITE', link: '/notifications' }), null);
  });

  it('firebase-messaging-sw route embeds SAFE_NOTIFICATION_LINK_SW_SOURCE', () => {
    const routePath = join(__dirname, '../app/firebase-messaging-sw.js/route.ts');
    const src = readFileSync(routePath, 'utf8');
    assert.match(src, /SAFE_NOTIFICATION_LINK_SW_SOURCE/);
    assert.match(src, /safeNotificationLink\(raw/);
    assert.ok(!src.includes("raw.charAt(0) === '/' && raw.charAt(1) !== '/'"));
  });
});
