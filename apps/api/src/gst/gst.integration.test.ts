/**
 * Optional live sandbox integration tests.
 * Skipped unless GST_RUN_INTEGRATION=true and real sandbox credentials are configured.
 *
 * Run: GST_RUN_INTEGRATION=true npm.cmd run test:gst:integration -w api
 *
 * Never hard-code real credentials or production GSTINs here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const enabled = process.env.GST_RUN_INTEGRATION === 'true';
const baseUrl = process.env.GST_INTEGRATION_API_URL || 'http://localhost:3001/api/v1';
const token = process.env.GST_INTEGRATION_BEARER_TOKEN || '';
const activeGstin = process.env.GST_TEST_ACTIVE_GSTIN || '';
const inactiveGstin = process.env.GST_TEST_INACTIVE_GSTIN || '';

async function postVerify(gstin: string) {
  const res = await fetch(`${baseUrl}/gst/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ gstin }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

describe('GST IRIS sandbox integration', { skip: !enabled }, () => {
  it('rejects empty GSTIN with 400', async () => {
    const { status, body } = await postVerify('');
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  it('rejects invalid GSTIN format with 400', async () => {
    const { status, body } = await postVerify('NOT-A-GSTIN');
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  it('verifies active sandbox GSTIN when GST_TEST_ACTIVE_GSTIN is set', async () => {
    if (!activeGstin) {
      console.log('Skip active GSTIN: set GST_TEST_ACTIVE_GSTIN');
      return;
    }
    assert.ok(token, 'Set GST_INTEGRATION_BEARER_TOKEN for authenticated call');
    const { body } = await postVerify(activeGstin);
    assert.equal(body.verified, true);
    assert.equal(body.status, 'ACTIVE');
  });

  it('reports non-active sandbox GSTIN when GST_TEST_INACTIVE_GSTIN is set', async () => {
    if (!inactiveGstin) {
      console.log('Skip inactive GSTIN: set GST_TEST_INACTIVE_GSTIN');
      return;
    }
    assert.ok(token, 'Set GST_INTEGRATION_BEARER_TOKEN for authenticated call');
    const { body } = await postVerify(inactiveGstin);
    assert.equal(body.verified, false);
    assert.ok(body.status === 'NOT_ACTIVE' || body.status === 'INACTIVE');
  });
});
