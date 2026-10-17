import assert from 'node:assert/strict';
import {
  deriveExperienceFlags,
  formatLocationLabel,
  resolveCandidateExperienceBand,
  resolveExperienceChip,
  resolveExperienceLevelChip,
} from './experience-status';

assert.equal(resolveCandidateExperienceBand({ hasExperience: 'YES' }), 'experienced');
assert.equal(resolveCandidateExperienceBand({ hasExperience: 'NONE' }), 'fresher');
assert.equal(resolveCandidateExperienceBand({ hasExperience: 'INTERNSHIP' }), 'fresher');
assert.equal(
  resolveCandidateExperienceBand({
    hasExperience: 'INTERNSHIP',
    totalExperienceYears: 2,
  }),
  'experienced',
);
assert.equal(
  resolveCandidateExperienceBand({
    hasExperience: 'INTERNSHIP',
    experiences: [{ isInternship: false, company: 'Acme', jobTitle: 'Dev' }],
  }),
  'experienced',
);
assert.equal(
  resolveCandidateExperienceBand({
    experiences: [{ isInternship: true, company: 'Intern Co' }],
  }),
  'fresher',
);
assert.equal(
  resolveCandidateExperienceBand({
    experiences: [{ isInternship: false, company: 'Paid Co', jobTitle: 'Eng' }],
  }),
  'experienced',
);

assert.equal(resolveExperienceLevelChip({ hasExperience: 'NONE' }), 'fresher');
assert.equal(
  resolveExperienceLevelChip({ hasExperience: 'YES', totalExperienceYears: 2 }),
  '1-3',
);
assert.equal(resolveExperienceChip({ hasExperience: 'NONE' }).label, 'FRESHER');
assert.equal(resolveExperienceChip({ hasExperience: 'YES', totalExperienceYears: 6 }).level, '5+');

assert.deepEqual(
  deriveExperienceFlags({
    experiences: [{ isInternship: true, company: 'X' }],
  }),
  { experienceLevel: 'fresher', hasExperience: 'INTERNSHIP' },
);

assert.equal(formatLocationLabel('Karnataka', 'Karnataka'), 'Karnataka');
assert.equal(formatLocationLabel('Bengaluru, Karnataka', 'Karnataka'), 'Bengaluru, Karnataka');

console.log('experience-status tests passed');
