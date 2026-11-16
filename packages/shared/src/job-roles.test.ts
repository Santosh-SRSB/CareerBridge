import assert from 'node:assert/strict';
import test from 'node:test';
import {
  careerTracksCompatible,
  detectRoleCategory,
  resolveCareerTrack,
  uniqueRoles,
} from './job-roles';

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

test('resolveCareerTrack keeps Talent Acquisition / BD on Non-IT even if JD mentions ERP', () => {
  assert.equal(
    resolveCareerTrack({ title: 'Talent Acquisition Executive', category: 'Human Resources' }),
    'NON_IT',
  );
  assert.equal(
    resolveCareerTrack({ title: 'Business Development Manager', category: 'Sales' }),
    'NON_IT',
  );
  assert.equal(
    resolveCareerTrack({ title: 'DevOps Engineer', category: 'Technology' }),
    'IT',
  );
});

test('careerTracksCompatible blocks IT profiles on Non-IT jobs and vice versa', () => {
  assert.equal(
    careerTracksCompatible(
      { title: 'Talent Acquisition Executive', category: 'Human Resources' },
      { interests: ['Software Developer'], skills: ['Python', 'AWS', 'DevOps'] },
    ),
    false,
  );
  assert.equal(
    careerTracksCompatible(
      { title: 'Talent Acquisition Executive', category: 'Human Resources' },
      { interests: ['Recruiter'], skills: ['Talent Acquisition', 'Sourcing'] },
    ),
    true,
  );
  assert.equal(
    careerTracksCompatible(
      { title: 'Backend Developer', category: 'Technology' },
      { interests: ['Sales Executive'], skills: ['Cold calling'] },
    ),
    false,
  );
});
