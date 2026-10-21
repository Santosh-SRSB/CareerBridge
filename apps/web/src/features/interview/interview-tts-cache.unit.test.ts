import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInterviewTtsCache, normalizeInterviewLine } from './interview-tts-cache';

test('interview lines collapse whitespace so prefetch and speak share a cache key', () => {
  assert.equal(normalizeInterviewLine('  Hi Priya,\n\ngood morning!  '), 'Hi Priya, good morning!');
});

test('concurrent loads of the same line share one fetch', async () => {
  let calls = 0;
  const cache = createInterviewTtsCache(async (text) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { audioBase64: `b64:${text}`, mimeType: 'audio/wav' };
  });

  const [a, b] = await Promise.all([cache.load('Hi there'), cache.load('  Hi there  ')]);
  assert.equal(calls, 1);
  assert.equal(a.audioBase64, 'b64:Hi there');
  assert.equal(b.audioBase64, 'b64:Hi there');
  assert.equal(cache.peek('Hi there')?.audioBase64, 'b64:Hi there');
});

test('a later speak hits the cache without fetching again', async () => {
  let calls = 0;
  const cache = createInterviewTtsCache(async () => {
    calls += 1;
    return { audioBase64: 'clip', mimeType: 'audio/wav' };
  });

  await cache.load('Welcome');
  await cache.load('Welcome');
  assert.equal(calls, 1);
});

test('a failed fetch is not cached so the next speak can retry', async () => {
  let calls = 0;
  const cache = createInterviewTtsCache(async () => {
    calls += 1;
    if (calls === 1) throw new Error('cold');
    return { audioBase64: 'ok', mimeType: 'audio/wav' };
  });

  await assert.rejects(() => cache.load('Hello'));
  const audio = await cache.load('Hello');
  assert.equal(calls, 2);
  assert.equal(audio.audioBase64, 'ok');
});
