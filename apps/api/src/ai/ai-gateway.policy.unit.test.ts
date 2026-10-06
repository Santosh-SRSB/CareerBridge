import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GeminiProvider } from './providers/gemini.provider';
import { AiGatewayService } from './ai-gateway.service';
import { AiCircuitBreaker, classifyAiError, linkedAbort } from './ai-resilience';

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

type FakeGenerate = (req: { model: string; config?: { abortSignal?: AbortSignal } }) => Promise<unknown>;

function providerWith(generate: FakeGenerate, values: Record<string, string | undefined> = {}) {
  const provider = new GeminiProvider(
    config({ GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'primary-model', GEMINI_FALLBACK_MODEL: 'fallback-model', ...values }),
  );
  const calls: string[] = [];
  (provider as unknown as { client: unknown }).client = {
    models: {
      generateContent: async (req: { model: string; config?: { abortSignal?: AbortSignal } }) => {
        calls.push(req.model);
        return generate(req);
      },
    },
  };
  return { provider, calls };
}

const unavailable = () => Object.assign(new Error('503 UNAVAILABLE: The model is experiencing high demand'), { status: 503 });
const ok = (text: string) => ({ text, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });

function fakePrisma(settings: Record<string, string> = {}, usage = { requests: 0, tokens: 0 }) {
  const interactions: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    interactions,
    audits,
    prisma: {
      platformSetting: {
        findMany: async () => Object.entries(settings).map(([key, value]) => ({ key, value })),
      },
      aiInteraction: {
        aggregate: async () => ({
          _count: { _all: usage.requests },
          _sum: { inputTokens: usage.tokens, outputTokens: 0 },
        }),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          interactions.push(data);
          return data;
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          audits.push(data);
          return data;
        },
      },
    },
  };
}

function gateway(provider: GeminiProvider, prisma: unknown, values: Record<string, string | undefined> = {}) {
  return new AiGatewayService(config(values), prisma as never, provider, {} as never);
}

const request = { task: 'GENERAL' as const, systemPrompt: 'Return JSON.', userPrompt: '{}' };

describe('AI error classification and circuit breaker', () => {
  it('classifies outages, timeouts and truncated output', () => {
    assert.equal(classifyAiError(unavailable()), 'UPSTREAM_UNAVAILABLE');
    assert.equal(classifyAiError(Object.assign(new Error('quota'), { status: 429 })), 'UPSTREAM_UNAVAILABLE');
    assert.equal(classifyAiError(Object.assign(new Error('x'), { name: 'TimeoutError' })), 'TIMEOUT');
    assert.equal(classifyAiError(new Error('Gemini returned invalid JSON (likely truncated).')), 'INVALID_OUTPUT');
    assert.equal(classifyAiError(new Error('400 bad request')), 'FAILED');
  });

  it('stays open for the cooldown window only', () => {
    let now = 1000;
    const breaker = new AiCircuitBreaker(60_000, () => now);
    breaker.open('UPSTREAM_UNAVAILABLE');
    assert.equal(breaker.current(), 'UPSTREAM_UNAVAILABLE');
    now += 59_999;
    assert.equal(breaker.current(), 'UPSTREAM_UNAVAILABLE');
    now += 1;
    assert.equal(breaker.current(), null);
  });

  it('linked abort fires on timeout and on parent abort', async () => {
    const timed = linkedAbort(undefined, 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(timed.signal.aborted, true);
    timed.dispose();
    const parent = new AbortController();
    const linked = linkedAbort(parent.signal, 0);
    parent.abort();
    assert.equal(linked.signal.aborted, true);
    linked.dispose();
  });
});

describe('Gemini retry policy', () => {
  it('a 503 is not retried on the same model: one primary call, one fallback call, then fail', async () => {
    const { provider, calls } = providerWith(async () => {
      throw unavailable();
    });
    await assert.rejects(provider.generateStructured('s', 'u'), /503/);
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
  });

  it('truncated JSON gets exactly one more try on the same model', async () => {
    let n = 0;
    const { provider, calls } = providerWith(async () => (n++ === 0 ? ok('{"a": [1, 2') : ok('{"a":1}')));
    const result = await provider.generateStructured<{ a: number }>('s', 'u');
    assert.deepEqual(result.data, { a: 1 });
    assert.deepEqual(calls, ['primary-model', 'primary-model']);
  });

  it('a hung call is aborted at the attempt timeout and not retried', async () => {
    const { provider, calls } = providerWith(
      (req) =>
        new Promise((_, reject) => {
          req.config?.abortSignal?.addEventListener('abort', () => reject(req.config?.abortSignal?.reason));
        }),
      { GEMINI_TIMEOUT_MS: '30' },
    );
    const started = Date.now();
    await assert.rejects(provider.generateStructured('s', 'u'), (err: Error) => err.name === 'TimeoutError');
    assert.ok(Date.now() - started < 1000);
    assert.deepEqual(calls, ['primary-model']);
  });

  it('a caller abort stops before any provider call', async () => {
    const { provider, calls } = providerWith(async () => ok('{}'));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(provider.generateStructured('s', 'u', { signal: controller.signal }));
    assert.deepEqual(calls, []);
  });
});

describe('AI gateway availability and cost controls', () => {
  it('after an outage the next request is skipped without calling Gemini and reports why', async () => {
    const { provider, calls } = providerWith(async () => {
      throw unavailable();
    });
    const { prisma } = fakePrisma();
    const ai = gateway(provider, prisma);
    const first = await ai.generate(request);
    assert.equal(first.success, false);
    assert.equal(first.unavailableReason, 'UPSTREAM_UNAVAILABLE');
    assert.equal(calls.length, 2);
    const second = await ai.generate(request);
    assert.equal(second.unavailableReason, 'UPSTREAM_UNAVAILABLE');
    assert.equal(calls.length, 2, 'known outage must not be retried');
  });

  it('ai.enabled=false stops all generation', async () => {
    const { provider, calls } = providerWith(async () => ok('{"a":1}'));
    const { prisma } = fakePrisma({ 'ai.enabled': 'false' });
    const res = await gateway(provider, prisma).generate(request);
    assert.equal(res.success, false);
    assert.equal(res.unavailableReason, 'DISABLED');
    assert.deepEqual(calls, []);
  });

  it('the daily request limit stops generation and writes one admin audit alert', async () => {
    const { provider, calls } = providerWith(async () => ok('{"a":1}'));
    const { prisma, audits } = fakePrisma({ 'ai.dailyRequestLimit': '5' }, { requests: 5, tokens: 0 });
    const ai = gateway(provider, prisma);
    const res = await ai.generate(request);
    await ai.generate(request);
    assert.equal(res.unavailableReason, 'DAILY_REQUEST_LIMIT');
    assert.deepEqual(calls, []);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'AI_DAILY_LIMIT_REACHED');
  });

  it('the daily token limit stops generation', async () => {
    const { provider, calls } = providerWith(async () => ok('{"a":1}'));
    const { prisma } = fakePrisma({ 'ai.tokenLimit': '1000' }, { requests: 1, tokens: 1000 });
    const res = await gateway(provider, prisma).generate(request);
    assert.equal(res.unavailableReason, 'DAILY_TOKEN_LIMIT');
    assert.deepEqual(calls, []);
  });

  it('usage from successful calls counts toward the limit within the cache window', async () => {
    const { provider, calls } = providerWith(async () => ok('{"a":1}'));
    const { prisma } = fakePrisma({ 'ai.dailyRequestLimit': '2' }, { requests: 0, tokens: 0 });
    const ai = gateway(provider, prisma);
    assert.equal((await ai.generate(request)).success, true);
    assert.equal((await ai.generate(request)).success, true);
    const third = await ai.generate(request);
    assert.equal(third.unavailableReason, 'DAILY_REQUEST_LIMIT');
    assert.equal(calls.length, 2);
  });
});
