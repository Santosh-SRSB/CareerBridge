/**
 * Primary gstinapi.in → AppyFlow fallback (mocked fetch; no live network).
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

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return String(input.url);
}

describe('gstinapi → AppyFlow fallback', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('uses AppyFlow when primary returns 523', async () => {
    const urls: string[] = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      const url = requestUrl(input);
      urls.push(url);
      if (url.includes('gstinapi.in')) {
        return jsonResponse(523, { success: false });
      }
      assert.match(url, /appyflow\.in\/api\/verifyGST/);
      assert.match(url, /key_secret=appy-secret/);
      assert.match(url, new RegExp(`gstNo=${ACTIVE_GSTIN}`));
      return jsonResponse(200, {
        error: false,
        taxpayerInfo: {
          gstin: ACTIVE_GSTIN,
          sts: 'Active',
          tradeNam: 'FALLBACK CO',
          lgnm: 'LEGAL NAME',
        },
      });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'appy-secret' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.tradeName, 'FALLBACK CO');
    assert.equal(urls.length, 2);
    assert.match(urls[0]!, /gstinapi\.in/);
    assert.match(urls[1]!, /appyflow\.in/);
  });

  it('does not call AppyFlow when primary returns a valid NOT_ACTIVE answer', async () => {
    const urls: string[] = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      urls.push(requestUrl(input));
      return jsonResponse(200, { success: false, code: 404 });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'appy-secret' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'NOT_ACTIVE');
    assert.equal(urls.length, 1);
    assert.match(urls[0]!, /gstinapi\.in/);
  });

  it('uses AppyFlow when primary key is rejected (401)', async () => {
    mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes('gstinapi.in')) {
        return jsonResponse(401, { success: false });
      }
      return jsonResponse(200, {
        error: false,
        taxpayerInfo: { gstin: ACTIVE_GSTIN, sts: 'Active', tradeNam: 'OK' },
      });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'appy-secret' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.tradeName, 'OK');
  });

  it('enriches missing gstinapi trade name from AppyFlow when primary is ACTIVE', async () => {
    mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes('gstinapi.in')) {
        return jsonResponse(200, {
          success: true,
          data: { gstin: ACTIVE_GSTIN, status: 'Active' },
        });
      }
      return jsonResponse(200, {
        error: false,
        taxpayerInfo: { gstin: ACTIVE_GSTIN, sts: 'Active', tradeNam: 'REGISTERED MARK', panNo: 'ABCDE1234F' },
      });
    });

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: 'primary-key', gstinApiFallbackKey: 'appy-secret' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.tradeName, 'REGISTERED MARK');
    assert.equal(result.pan, 'ABCDE1234F');
  });

  it('maps AppyFlow Inactive sts to NOT_ACTIVE', async () => {
    mock.method(globalThis, 'fetch', async () =>
      jsonResponse(200, {
        error: false,
        taxpayerInfo: { gstin: ACTIVE_GSTIN, sts: 'Cancelled', tradeNam: 'X' },
      }),
    );

    const provider = new IrisIrpGstProvider(
      cfg({ gstinApiKey: '', gstinApiFallbackKey: 'appy-secret' }),
    );
    const result = await provider.getGstinDetails(ACTIVE_GSTIN);
    assert.equal(result.status, 'NOT_ACTIVE');
  });
});
