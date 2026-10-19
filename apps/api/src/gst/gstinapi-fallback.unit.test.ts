/**
 * GSTINAPI primary → fallback key behaviour (mocked fetch; no live network).
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { GstConfigService } from './gst.config';
import { IrisIrpGstProvider } from './gst.provider';

const ACTIVE_GSTIN = '29ABCDE1234F1ZW';

function cfg(partial: { gstinApiKey: string; gstinApiFallbackKey?: string }) {
  return {
    get: () =>
      ({
        environment: 'sandbox',
        provider: 'GSTINAPI',
        gstinApiKey: partial.gstinApiKey,
        gstinApiFallbackKey: partial.gstinApiFallbackKey || '',
        baseUrl: '',
        authPath: '',
        getGstinPath: '',
        clientId: '',
        clientSecret: '',
        portalId: '',
        requesterGstin: '',
        username: '',
        password: '',
        publicKeyPem: '',
        timeoutMs: 5000,
        maxRetries: 0,
        mockEnabled: false,
        isPlaceholder: true,
        configured: false,
      }) as ReturnType<GstConfigService['get']>,
  } as GstConfigService;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('gstinapi primary → fallback key', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('uses fallback key when primary returns 523', async () => {
    const calls: string[] = [];
    mock.method(globalThis, 'fetch', async (_url: string | URL, init?: RequestInit) => {
      const key = String((init?.headers as Record<string, string>)?.['x-api-key'] || '');
      calls.push(key);
      if (key === 'primary-key') {
        return jsonResponse(523, { success: false });
      }
      return jsonResponse(200, {
        success: true,
        data: { gstin: ACTIVE_GSTIN, status: 'Active', trade_name: 'FALLBACK CO' },
      });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'fallback-key' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.tradeName, 'FALLBACK CO');
    assert.deepEqual(calls, ['primary-key', 'fallback-key']);
  });

  it('does not call fallback when primary returns a valid NOT_ACTIVE answer', async () => {
    const calls: string[] = [];
    mock.method(globalThis, 'fetch', async (_url: string | URL, init?: RequestInit) => {
      const key = String((init?.headers as Record<string, string>)?.['x-api-key'] || '');
      calls.push(key);
      return jsonResponse(200, { success: false, code: 404 });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'fallback-key' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'NOT_ACTIVE');
    assert.deepEqual(calls, ['primary-key']);
  });

  it('uses fallback when primary key is rejected (401)', async () => {
    const calls: string[] = [];
    mock.method(globalThis, 'fetch', async (_url: string | URL, init?: RequestInit) => {
      const key = String((init?.headers as Record<string, string>)?.['x-api-key'] || '');
      calls.push(key);
      if (key === 'primary-key') {
        return jsonResponse(401, { success: false });
      }
      return jsonResponse(200, {
        success: true,
        data: { gstin: ACTIVE_GSTIN, status: 'Active', trade_name: 'OK' },
      });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'fallback-key' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'ACTIVE');
    assert.deepEqual(calls, ['primary-key', 'fallback-key']);
  });
});
