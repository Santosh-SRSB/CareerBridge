import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeAiClientError, scrubSensitiveAiValue, containsSensitiveAiMaterial } from './ai-client-error';

describe('sanitizeAiClientError (SEC-INT-013)', () => {
  it('redacts Gemini-style API keys and private key material', () => {
    assert.equal(
      sanitizeAiClientError('GoogleGenerativeAI Error: [429] for key AIzaSyDummyKeyValue1234567890ab'),
      'AI request failed.',
    );
    assert.equal(
      sanitizeAiClientError('auth failed GEMINI_API_KEY=super-secret-value-here'),
      'AI request failed.',
    );
    assert.equal(
      sanitizeAiClientError('-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'),
      'AI request failed.',
    );
  });

  it('keeps short non-sensitive provider messages', () => {
    assert.equal(sanitizeAiClientError('503 UNAVAILABLE: high demand'), '503 UNAVAILABLE: high demand');
    assert.equal(sanitizeAiClientError('Gemini returned invalid JSON (likely truncated).'), 'Gemini returned invalid JSON (likely truncated).');
  });

  it('handles empty input', () => {
    assert.equal(sanitizeAiClientError(''), 'AI request failed.');
    assert.equal(sanitizeAiClientError(null), 'AI request failed.');
  });
});

describe('scrubSensitiveAiValue (SEC-INJ-009)', () => {
  it('redacts nested credential-like strings and leaves safe text', () => {
    const scrubbed = scrubSensitiveAiValue({
      summary: 'Solid candidate',
      strengths: ['Clear name', 'GEMINI_API_KEY=exfil-secret-value-please'],
      nested: { tip: 'AIzaSyLeakTestKey1234567890ab should not ship' },
    });
    assert.equal(scrubbed.summary, 'Solid candidate');
    assert.equal(scrubbed.strengths[1], '[REDACTED]');
    assert.equal(scrubbed.nested.tip, '[REDACTED]');
    assert.equal(containsSensitiveAiMaterial(JSON.stringify(scrubbed)), false);
  });
});
