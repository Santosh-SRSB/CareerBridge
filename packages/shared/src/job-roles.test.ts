import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRoleCategory, uniqueRoles } from './job-roles';

test('detectRoleCategory maps interests to a catalogue category', () => {
  assert.equal(detectRoleCategory(['Software Developer']), 'IT');
  assert.equal(detectRoleCategory(['Tax filing']), 'FINANCE');
  assert.equal(detectRoleCategory(['Retail sales']), 'SALES');
  assert.equal(detectRoleCategory([]), 'GENERAL');
});

test('uniqueRoles trims, collapses spaces and dedupes case-insensitively', () => {
  assert.deepEqual(uniqueRoles(['  Data  Analyst ', 'data analyst', '', null, 'QA Engineer']), [
    'Data Analyst',
    'QA Engineer',
  ]);
});
