/**
 * SEC-FE-007 — nav return paths must stay same-origin relative (no open redirects via storage).
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  clearReturnStack,
  consumeReturnTo,
  goToReturnTo,
  rememberReturnTo,
  sanitizeReturnPath,
} from './nav-return';

describe('SEC-FE-007 sanitizeReturnPath', () => {
  it('allows same-origin relative paths including query strings', () => {
    assert.equal(sanitizeReturnPath('/dashboard'), '/dashboard');
    assert.equal(sanitizeReturnPath('/jobs?q=1'), '/jobs?q=1');
  });

  it('rejects absolute, protocol-relative, backslash, and scheme-bearing destinations', () => {
    assert.equal(sanitizeReturnPath('https://evil.example/x'), null);
    assert.equal(sanitizeReturnPath('//evil.example/x'), null);
    assert.equal(sanitizeReturnPath('javascript:alert(1)'), null);
    assert.equal(sanitizeReturnPath('/javascript:alert(1)'), null);
    assert.equal(sanitizeReturnPath('/\\evil'), null);
    assert.equal(sanitizeReturnPath(''), null);
    assert.equal(sanitizeReturnPath(null), null);
  });
});

describe('SEC-FE-007 nav return stack storage', () => {
  const store = new Map<string, string>();
  const priorWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    store.clear();
    (globalThis as { window: unknown }).window = {
      location: { pathname: '/dashboard', search: '' },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    };
  });

  afterEach(() => {
    if (priorWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window: unknown }).window = priorWindow;
  });

  it('stores safe paths and drops unsafe values already in sessionStorage', () => {
    rememberReturnTo('/applications');
    assert.equal(consumeReturnTo(), '/applications');
    store.set(
      'cb.navReturnStack',
      JSON.stringify(['/ok', '//evil.example', 'https://evil.example', '/still-ok']),
    );
    assert.equal(consumeReturnTo(), '/still-ok');
    assert.equal(consumeReturnTo(), '/ok');
    assert.equal(consumeReturnTo(), null);
  });

  it('goToReturnTo never pushes an unsafe destination', () => {
    const pushed: string[] = [];
    store.set('cb.navReturnStack', JSON.stringify(['//evil.example/phish']));
    goToReturnTo({ push: (href) => pushed.push(href) }, '/dashboard');
    assert.deepEqual(pushed, ['/dashboard']);
  });

  it('clearReturnStack removes the key', () => {
    rememberReturnTo('/jobs');
    clearReturnStack();
    assert.equal(consumeReturnTo(), null);
  });
});
