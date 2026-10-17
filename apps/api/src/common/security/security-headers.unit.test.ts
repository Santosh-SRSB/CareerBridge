import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSecurityHeaders } from './security-headers';

describe('buildSecurityHeaders (SEC-CLOUD-009)', () => {
  it('sets baseline headers and strict CSP when swagger is off', () => {
    const h = buildSecurityHeaders({ enableHsts: false, swaggerEnabled: false });
    assert.equal(h['X-Content-Type-Options'], 'nosniff');
    assert.equal(h['X-Frame-Options'], 'DENY');
    assert.equal(h['Referrer-Policy'], 'no-referrer');
    assert.match(h['Permissions-Policy'], /camera=\(\)/);
    assert.match(h['Content-Security-Policy'], /default-src 'none'/);
    assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'/);
    assert.equal(h['Strict-Transport-Security'], undefined);
    assert.equal(h['Cross-Origin-Resource-Policy'], undefined);
    assert.equal(h['Cross-Origin-Opener-Policy'], undefined);
  });

  it('emits HSTS only when enableHsts is true', () => {
    const h = buildSecurityHeaders({ enableHsts: true, swaggerEnabled: false });
    assert.equal(h['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  });

  it('uses frame-ancestors-only CSP when swagger is enabled (local docs)', () => {
    const h = buildSecurityHeaders({ enableHsts: false, swaggerEnabled: true });
    assert.equal(h['Content-Security-Policy'], "frame-ancestors 'none'");
    assert.ok(!h['Content-Security-Policy'].includes("default-src 'none'"));
    assert.equal(h['Cross-Origin-Resource-Policy'], undefined);
    assert.equal(h['Cross-Origin-Opener-Policy'], undefined);
  });

  it('never sets CORP or COOP (separate Cloud Run web/API hosts)', () => {
    for (const opts of [
      { enableHsts: false, swaggerEnabled: false },
      { enableHsts: true, swaggerEnabled: false },
      { enableHsts: true, swaggerEnabled: true },
    ]) {
      const h = buildSecurityHeaders(opts);
      assert.ok(!('Cross-Origin-Resource-Policy' in h));
      assert.ok(!('Cross-Origin-Opener-Policy' in h));
    }
  });
});
