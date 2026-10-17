import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ariaSortFor, nextSort, sortRows } from './table-sort';

test('nextSort flips direction on the active column and resets on a new column', () => {
  assert.deepEqual(nextSort({ key: 'name', dir: 'asc' }, 'name'), { key: 'name', dir: 'desc' });
  assert.deepEqual(nextSort({ key: 'name', dir: 'desc' }, 'name'), { key: 'name', dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'name', dir: 'desc' }, 'score', 'desc'), { key: 'score', dir: 'desc' });
});

test('sortRows orders numbers and strings in both directions', () => {
  const rows = [
    { name: 'charlie', score: 70 },
    { name: 'Alpha', score: 91 },
    { name: 'bravo', score: 55 },
  ];
  assert.deepEqual(
    sortRows(rows, (r) => r.score, 'asc').map((r) => r.score),
    [55, 70, 91],
  );
  assert.deepEqual(
    sortRows(rows, (r) => r.score, 'desc').map((r) => r.score),
    [91, 70, 55],
  );
  assert.deepEqual(
    sortRows(rows, (r) => r.name, 'asc').map((r) => r.name),
    ['Alpha', 'bravo', 'charlie'],
  );
  assert.deepEqual(
    sortRows(rows, (r) => r.name, 'desc').map((r) => r.name),
    ['charlie', 'bravo', 'Alpha'],
  );
});

test('sortRows keeps empty values last and does not mutate the input', () => {
  const rows = [{ v: null }, { v: 2 }, { v: undefined }, { v: 1 }] as Array<{ v: number | null | undefined }>;
  const snapshot = [...rows];
  assert.deepEqual(
    sortRows(rows, (r) => r.v, 'asc').map((r) => r.v),
    [1, 2, null, undefined],
  );
  assert.deepEqual(
    sortRows(rows, (r) => r.v, 'desc').map((r) => r.v),
    [2, 1, null, undefined],
  );
  assert.deepEqual(rows, snapshot);
});

test('ariaSortFor reports the active column only', () => {
  assert.equal(ariaSortFor({ key: 'a', dir: 'asc' }, 'a'), 'ascending');
  assert.equal(ariaSortFor({ key: 'a', dir: 'desc' }, 'a'), 'descending');
  assert.equal(ariaSortFor({ key: 'a', dir: 'desc' }, 'b'), 'none');
});
