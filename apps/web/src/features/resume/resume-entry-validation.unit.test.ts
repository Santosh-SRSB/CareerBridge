import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasEntryErrors,
  validateEducationEntry,
  validateExperienceEntry,
} from './resume-entry-validation';

const NOW = new Date(2026, 8, 29);

test('blank education entry reports every required field', () => {
  const errors = validateEducationEntry(
    { degree: '', institution: ' ', startDate: '', endDate: '', isCurrent: false },
    NOW,
  );
  assert.equal(errors.degree, 'Degree is required');
  assert.equal(errors.institution, 'Institution name is required');
  assert.equal(errors.endDate, 'Year of completion is required');
  assert.equal(hasEntryErrors(errors), true);
});

test('education completion year cannot be in the future unless currently studying', () => {
  const base = { degree: 'B.Tech', institution: 'CUSAT', startDate: '2022-06' };
  assert.equal(
    validateEducationEntry({ ...base, endDate: '2030-04', isCurrent: false }, NOW).endDate,
    'Year cannot be in the future',
  );
  assert.equal(hasEntryErrors(validateEducationEntry({ ...base, endDate: '2026-04', isCurrent: false }, NOW)), false);
  assert.equal(hasEntryErrors(validateEducationEntry({ ...base, endDate: '', isCurrent: true }, NOW)), false);
  assert.equal(
    validateEducationEntry({ ...base, endDate: '2021-04', isCurrent: false }, NOW).endDate,
    'Completion date must be after the start date',
  );
});

test('blank experience entry reports every required field', () => {
  const errors = validateExperienceEntry(
    { role: '', company: '', startDate: '', endDate: '', isCurrent: false },
    NOW,
  );
  assert.deepEqual(errors, {
    role: 'Job title is required',
    company: 'Company name is required',
    startDate: 'Start date is required',
    endDate: 'End date is required',
  });
});

test('experience end date is optional only while currently working', () => {
  const base = { role: 'Agent', company: 'Acme', startDate: '2024-01', endDate: '' };
  assert.equal(hasEntryErrors(validateExperienceEntry({ ...base, isCurrent: true }, NOW)), false);
  assert.equal(validateExperienceEntry({ ...base, isCurrent: false }, NOW).endDate, 'End date is required');
  assert.equal(
    validateExperienceEntry({ ...base, endDate: '2026-12', isCurrent: false }, NOW).endDate,
    'End date cannot be in the future',
  );
  assert.equal(
    validateExperienceEntry({ ...base, startDate: '2027-01', isCurrent: true }, NOW).startDate,
    'Start date cannot be in the future',
  );
});
