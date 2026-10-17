import assert from 'node:assert/strict';
import test from 'node:test';
import { jobSalaryRequiredError } from './validation';

test('jobSalaryRequiredError requires both ends of the range', () => {
  assert.equal(jobSalaryRequiredError('', '22000'), 'Minimum salary is required');
  assert.equal(jobSalaryRequiredError(0, 22000), 'Minimum salary is required');
  assert.equal(jobSalaryRequiredError('18000', ''), 'Maximum salary is required');
  assert.equal(jobSalaryRequiredError(18000, null), 'Maximum salary is required');
  assert.equal(jobSalaryRequiredError('18000', '22000'), null);
});
