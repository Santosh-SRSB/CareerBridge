import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SALARY_RANGE_INVALID_MESSAGE,
  catalogKindFromSlug,
  employmentStatusNeedsExperience,
  parseSkippedSteps,
  validateExpectedSalaryRange,
} from './catalog';
import { parseExperienceRange } from './experience-range';
import { DEFAULT_EXPERIENCE_LEVELS } from './catalog';

test('expected salary range is optional but must be positive and ordered', () => {
  assert.equal(validateExpectedSalaryRange(null, null), null);
  assert.equal(validateExpectedSalaryRange(20000, null), null);
  assert.equal(validateExpectedSalaryRange(20000, 30000), null);
  assert.equal(validateExpectedSalaryRange(50000, 30000), SALARY_RANGE_INVALID_MESSAGE);
  assert.equal(validateExpectedSalaryRange(30000, 30000), SALARY_RANGE_INVALID_MESSAGE);
  assert.equal(validateExpectedSalaryRange(-5000, 30000), SALARY_RANGE_INVALID_MESSAGE);
  assert.equal(validateExpectedSalaryRange(0, null), SALARY_RANGE_INVALID_MESSAGE);
  assert.equal(validateExpectedSalaryRange(1000.5, null), SALARY_RANGE_INVALID_MESSAGE);
});

test('years of experience only applies to employed / not employed', () => {
  assert.equal(employmentStatusNeedsExperience('EMPLOYED'), true);
  assert.equal(employmentStatusNeedsExperience('NOT_EMPLOYED'), true);
  assert.equal(employmentStatusNeedsExperience('FRESHER'), false);
  assert.equal(employmentStatusNeedsExperience('STUDENT'), false);
});

test('default experience levels parse into year ranges', () => {
  const mins = DEFAULT_EXPERIENCE_LEVELS.map((level) => parseExperienceRange(level.label)?.min);
  assert.deepEqual(mins, [0, 1, 2, 5]);
});

test('skipped steps parse from JSON and drop invalid entries', () => {
  assert.deepEqual(parseSkippedSteps('[3,1,1,9,"2"]'), [1, 2, 3]);
  assert.deepEqual(parseSkippedSteps('not json'), []);
  assert.deepEqual(parseSkippedSteps(null), []);
});

test('catalog slugs resolve to kinds', () => {
  assert.equal(catalogKindFromSlug('job-categories'), 'JOB_CATEGORY');
  assert.equal(catalogKindFromSlug('Locations'), 'LOCATION_CITY');
  assert.equal(catalogKindFromSlug('bogus'), null);
});
