import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatProgrammeFee,
  isTechnologyDomainCandidate,
  programmeFeePublishError,
} from './marketplace';

test('isTechnologyDomainCandidate matches Technology only', () => {
  assert.equal(isTechnologyDomainCandidate(['Technology']), true);
  assert.equal(isTechnologyDomainCandidate(['technology']), true);
  assert.equal(isTechnologyDomainCandidate(['Software Development']), false);
  assert.equal(isTechnologyDomainCandidate(['IT']), false);
  assert.equal(isTechnologyDomainCandidate([]), false);
});

test('formatProgrammeFee covers disclosure modes', () => {
  assert.equal(formatProgrammeFee({ feeType: 'FREE' }), 'No programme fee');
  assert.equal(formatProgrammeFee({ feeType: 'FIXED', feeAmount: 25000 }), 'Programme fee: ₹25,000');
  assert.equal(
    formatProgrammeFee({ feeType: 'RANGE', feeMin: 10000, feeMax: 20000 }),
    'Programme fee: ₹10,000–₹20,000',
  );
  assert.match(
    String(formatProgrammeFee({ feeType: 'DISCUSSED_WITH_EMPLOYER' })),
    /discussed/i,
  );
});

test('programmeFeePublishError requires fee disclosure for training', () => {
  assert.ok(programmeFeePublishError({ opportunityType: 'INTERNSHIP_TRAINING' }));
  assert.equal(
    programmeFeePublishError({ opportunityType: 'INTERNSHIP_TRAINING', feeType: 'FREE' }),
    null,
  );
  assert.equal(programmeFeePublishError({ opportunityType: 'JOB' }), null);
});
