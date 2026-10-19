/**
 * GST health/verify payloads must not echo provider credentials (SEC-INT-006).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GstService } from './gst.service';

const SECRET_MARKERS = [
  'clientSecret',
  'client_secret',
  'password',
  'username',
  'publicKeyPem',
  'gstinApiKey',
  'gstinApiFallbackKey',
  'GSTINAPI_KEY',
  'GSTINAPI_FALLBACK_KEY',
  'DEMO_SANDBOX_CLIENT_SECRET',
  'super-secret-iris',
];

function gstWithSecrets(
  providerResult: { status: 'ACTIVE' | 'NOT_ACTIVE'; tradeName: string | null; responseCode: string },
  opts: { gstinApiFallbackKey?: string } = {},
) {
  return new GstService(
    {
      get: () => ({
        configured: false,
        environment: 'sandbox',
        provider: 'MOCK',
        mockEnabled: true,
        gstinApiKey: '',
        gstinApiFallbackKey: opts.gstinApiFallbackKey ?? '',
        clientSecret: 'super-secret-iris',
        password: 'demo-password',
        username: 'demo-user',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nX\n-----END PUBLIC KEY-----',
        clientId: 'DEMO_SANDBOX_CLIENT_ID',
      }),
    } as never,
    { getGstinDetails: async () => providerResult } as never,
    {} as never,
    { isConfigured: () => false } as never,
  );
}

describe('GstService credential boundary (SEC-INT-006)', () => {
  it('health returns only public flags — never secrets from GstConfigService', () => {
    const body = gstWithSecrets(
      { status: 'ACTIVE', tradeName: 'Brand', responseCode: 'MOCK' },
      { gstinApiFallbackKey: 'fallback-secret-key' },
    ).health();
    assert.deepEqual(
      Object.keys(body).sort(),
      ['configured', 'environment', 'gstinApiFallbackConfigured', 'mockEnabled', 'provider'].sort(),
    );
    assert.equal(body.provider, 'MOCK');
    assert.equal(body.gstinApiFallbackConfigured, true);
    const serialized = JSON.stringify(body);
    for (const marker of SECRET_MARKERS) {
      assert.ok(!serialized.includes(marker), `health must not contain ${marker}`);
    }
    assert.ok(!serialized.includes('fallback-secret-key'), 'health must not echo fallback key value');
  });

  it('verify MOCK payload omits credentials', async () => {
    // Valid checksum GSTIN used by unit validator suite.
    const gstin = '29ABCDE1234F1ZW';
    const payload = await gstWithSecrets({ status: 'ACTIVE', tradeName: 'Brand', responseCode: 'MOCK' }).verify(gstin);
    const serialized = JSON.stringify(payload);
    for (const marker of SECRET_MARKERS) {
      assert.ok(!serialized.includes(marker), `verify must not contain ${marker}`);
    }
    assert.equal(payload.provider, 'MOCK');
    assert.equal(payload.mock, true);
  });
});
