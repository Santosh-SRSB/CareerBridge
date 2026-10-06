import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_SUGGESTIONS_UNAVAILABLE_MESSAGE,
  aiSuggestionsUnavailableMessage,
  aiUsageDayStart,
  evaluateAiBudget,
  parseAiSettings,
} from './ai-availability';

const base = { enabled: true, dailyRequestLimit: 100, dailyTokenLimit: 1000, requestsToday: 0, tokensToday: 0 };

test('AI budget allows requests under both limits', () => {
  assert.equal(evaluateAiBudget({ ...base, requestsToday: 99, tokensToday: 999 }), null);
});

test('AI budget stops when disabled, request limit or token limit is reached', () => {
  assert.equal(evaluateAiBudget({ ...base, enabled: false }), 'DISABLED');
  assert.equal(evaluateAiBudget({ ...base, requestsToday: 100 }), 'DAILY_REQUEST_LIMIT');
  assert.equal(evaluateAiBudget({ ...base, tokensToday: 1000 }), 'DAILY_TOKEN_LIMIT');
});

test('a zero limit means unlimited', () => {
  assert.equal(evaluateAiBudget({ ...base, dailyRequestLimit: 0, dailyTokenLimit: 0, requestsToday: 1e9, tokensToday: 1e9 }), null);
});

test('AI settings parse with defaults and treat "false" as disabled', () => {
  assert.deepEqual(parseAiSettings({}), { enabled: true, dailyRequestLimit: 50000, dailyTokenLimit: 2000000 });
  assert.deepEqual(parseAiSettings({ 'ai.enabled': 'false', 'ai.dailyRequestLimit': '10', 'ai.tokenLimit': 'abc' }), {
    enabled: false,
    dailyRequestLimit: 10,
    dailyTokenLimit: 0,
  });
});

test('usage day starts at midnight India time', () => {
  assert.equal(aiUsageDayStart(new Date('2026-09-29T20:00:00Z')).toISOString(), '2026-09-29T18:30:00.000Z');
  assert.equal(aiUsageDayStart(new Date('2026-09-29T17:00:00Z')).toISOString(), '2026-09-28T18:30:00.000Z');
});

test('unavailable message matches the handbook wording for an outage', () => {
  assert.equal(aiSuggestionsUnavailableMessage('UPSTREAM_UNAVAILABLE'), AI_SUGGESTIONS_UNAVAILABLE_MESSAGE);
  assert.equal(
    AI_SUGGESTIONS_UNAVAILABLE_MESSAGE,
    'AI suggestions are temporarily unavailable. You can continue editing manually.',
  );
  assert.match(aiSuggestionsUnavailableMessage('DAILY_TOKEN_LIMIT'), /usage limit/);
});
