import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_LIST_POLL_MS,
  ADMIN_LIST_POLL_TABS,
  isAdminListPollTab,
  startVisiblePoll,
  type VisiblePollClock,
} from './visible-poll';

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createFakeClock() {
  let hidden = false;
  const intervals = new Map<number, () => void>();
  const listeners = new Set<() => void>();
  let nextId = 1;

  const clock: VisiblePollClock = {
    setInterval(handler) {
      const id = nextId++;
      intervals.set(id, handler);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    addEventListener(_type, handler) {
      listeners.add(handler);
    },
    removeEventListener(_type, handler) {
      listeners.delete(handler);
    },
    hidden: () => hidden,
  };

  return {
    clock,
    setHidden(value: boolean) {
      hidden = value;
    },
    fireInterval() {
      for (const handler of [...intervals.values()]) handler();
    },
    fireVisibility() {
      for (const handler of [...listeners]) handler();
    },
    intervalCount: () => intervals.size,
    listenerCount: () => listeners.size,
  };
}

test('polls candidate and employer tabs every 30 seconds and ignores other admin tabs', () => {
  assert.equal(ADMIN_LIST_POLL_MS, 30_000);
  assert.deepEqual([...ADMIN_LIST_POLL_TABS], ['candidates', 'employers']);
  assert.equal(isAdminListPollTab('candidates'), true);
  assert.equal(isAdminListPollTab('employers'), true);
  assert.equal(isAdminListPollTab('dashboard'), false);
  assert.equal(isAdminListPollTab('jobs'), false);
});

test('does not refresh immediately and fires after each interval while visible', async () => {
  const fake = createFakeClock();
  const calls: number[] = [];
  const stop = startVisiblePoll({
    intervalMs: 30_000,
    refresh: () => {
      calls.push(Date.now());
    },
    clock: fake.clock,
  });

  assert.equal(calls.length, 0);
  fake.fireInterval();
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  fake.fireInterval();
  await flushMicrotasks();
  assert.equal(calls.length, 2);
  stop();
});

test('skips interval ticks while the document is hidden', async () => {
  const fake = createFakeClock();
  let calls = 0;
  const stop = startVisiblePoll({
    intervalMs: 30_000,
    refresh: () => {
      calls += 1;
    },
    clock: fake.clock,
  });

  fake.setHidden(true);
  fake.fireInterval();
  await Promise.resolve();
  assert.equal(calls, 0);
  stop();
});

test('refreshes when the document becomes visible again', async () => {
  const fake = createFakeClock();
  let calls = 0;
  const stop = startVisiblePoll({
    intervalMs: 30_000,
    refresh: () => {
      calls += 1;
    },
    clock: fake.clock,
  });

  fake.setHidden(true);
  fake.fireVisibility();
  await Promise.resolve();
  assert.equal(calls, 0);

  fake.setHidden(false);
  fake.fireVisibility();
  await Promise.resolve();
  assert.equal(calls, 1);
  stop();
});

test('does not start a second refresh while one is in flight', async () => {
  const fake = createFakeClock();
  let started = 0;
  let resolveRefresh: (() => void) | undefined;
  const stop = startVisiblePoll({
    intervalMs: 30_000,
    refresh: () =>
      new Promise<void>((resolve) => {
        started += 1;
        resolveRefresh = resolve;
      }),
    clock: fake.clock,
  });

  fake.fireInterval();
  await flushMicrotasks();
  assert.equal(started, 1);

  fake.fireInterval();
  fake.fireVisibility();
  await flushMicrotasks();
  assert.equal(started, 1);

  resolveRefresh?.();
  await flushMicrotasks();
  fake.fireInterval();
  await flushMicrotasks();
  assert.equal(started, 2);
  stop();
});

test('cleanup clears the timer and ignores later ticks or visibility events', async () => {
  const fake = createFakeClock();
  let calls = 0;
  const stop = startVisiblePoll({
    intervalMs: 30_000,
    refresh: () => {
      calls += 1;
    },
    clock: fake.clock,
  });

  assert.equal(fake.intervalCount(), 1);
  assert.equal(fake.listenerCount(), 1);
  stop();
  assert.equal(fake.intervalCount(), 0);
  assert.equal(fake.listenerCount(), 0);

  fake.fireInterval();
  fake.setHidden(false);
  fake.fireVisibility();
  await Promise.resolve();
  assert.equal(calls, 0);
});

test('super-admin dashboard polls only candidate and employer lists silently', () => {
  const source = readFileSync(join(__dirname, '../app/adminsrsb/dashboard/dashboard-inner.tsx'), 'utf8');
  assert.match(source, /startVisiblePoll/);
  assert.match(source, /ADMIN_LIST_POLL_MS/);
  assert.match(source, /isAdminListPollTab\(tab\)/);
  assert.match(source, /silent:\s*true/);
  assert.doesNotMatch(source, /getAdminDashboard\(\)[\s\S]{0,80}startVisiblePoll/);
  assert.match(source, /listInFlightCountRef/);
});
