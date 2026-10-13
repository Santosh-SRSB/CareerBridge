import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiSecurityHeaders, exposeApiDocs } from '../common/http/security-headers';
import { cloudTaskSecretStatus } from '../common/tasks/task-secret';
import { resumeWorkerAuth } from './resume-worker-auth';

describe('resume worker authentication', () => {
  it('rejects a cloud process that has no task secret', () => {
    assert.equal(resumeWorkerAuth('', undefined, { NODE_ENV: 'production' }), 'missing_secret');
    assert.equal(resumeWorkerAuth('  ', 'anything', { GCP_PROJECT_ID: 'careerbridge-f7b72' }), 'missing_secret');
  });

  it('allows local development without a task secret', () => {
    assert.equal(resumeWorkerAuth('', undefined, { NODE_ENV: 'development' }), 'ok');
  });

  it('rejects a missing or wrong secret when one is configured', () => {
    assert.equal(resumeWorkerAuth('task-secret', undefined, {}), 'mismatch');
    assert.equal(resumeWorkerAuth('task-secret', '', { NODE_ENV: 'production' }), 'mismatch');
    assert.equal(resumeWorkerAuth('task-secret', 'task-secreT', {}), 'mismatch');
    assert.equal(resumeWorkerAuth('task-secret', 'task-secret-extra', {}), 'mismatch');
  });

  it('accepts an exact secret', () => {
    assert.equal(resumeWorkerAuth('task-secret', 'task-secret', { NODE_ENV: 'production' }), 'ok');
  });

  it('uses the same fail-closed rule for the WhatsApp task callback', () => {
    assert.equal(cloudTaskSecretStatus('', undefined, { GCP_PROJECT_ID: 'careerbridge-f7b72' }), 'missing_secret');
    assert.equal(cloudTaskSecretStatus('', '', { NODE_ENV: 'production' }), 'missing_secret');
    assert.equal(cloudTaskSecretStatus('   ', '', { GCP_PROJECT_ID: 'careerbridge-f7b72' }), 'missing_secret');
    assert.equal(cloudTaskSecretStatus('wa-secret', '', { NODE_ENV: 'production' }), 'mismatch');
    assert.equal(cloudTaskSecretStatus('wa-secret', 'wrong', { NODE_ENV: 'production' }), 'mismatch');
    assert.equal(cloudTaskSecretStatus('wa-secret', 'wa-secret', { NODE_ENV: 'production' }), 'ok');
  });
});

describe('API security headers', () => {
  it('sets nosniff, frame denial, and referrer policy', () => {
    const headers = apiSecurityHeaders('development');
    assert.equal(headers.find((header) => header.key === 'X-Content-Type-Options')?.value, 'nosniff');
    assert.equal(headers.find((header) => header.key === 'X-Frame-Options')?.value, 'DENY');
    assert.equal(headers.find((header) => header.key === 'Referrer-Policy')?.value, 'no-referrer');
    assert.equal(headers.some((header) => header.key === 'Strict-Transport-Security'), false);
  });

  it('adds HSTS only in production and hides API docs there', () => {
    assert.equal(
      apiSecurityHeaders('production').some((header) => header.key === 'Strict-Transport-Security'),
      true,
    );
    assert.equal(exposeApiDocs('production'), false);
    assert.equal(exposeApiDocs('development'), true);
  });
});
