import assert from 'node:assert/strict';
import test from 'node:test';
import { toAtsMatchBreakdown } from '@careerbridge/shared';
import { IntelligenceService, type MatchCandidate, type MatchJob } from './intelligence.service';

const svc = new IntelligenceService();

const baseCandidate: MatchCandidate = {
  city: 'Chennai',
  careerInterests: [],
  skills: ['Communication', 'MS Excel', 'Sales', 'English'],
  hasExperience: 'YES',
  experienceYears: 3,
  hasEducation: true,
  languages: ['English', 'Tamil'],
};

const baseJob: MatchJob = {
  city: 'Chennai',
  category: 'Sales',
  requiredSkills: ['Communication', 'MS Excel', 'Sales', 'English'],
  experience: '2 - 4 Years',
  languages: ['English', 'Tamil'],
};

function points(candidate: Partial<MatchCandidate>, job: Partial<MatchJob>) {
  const match = svc.match({ ...baseCandidate, ...candidate }, { ...baseJob, ...job });
  const byKey = Object.fromEntries(toAtsMatchBreakdown(match).factors.map((f) => [f.key, f.score]));
  return { match, byKey };
}

test('skills: 3 of 4 required skills = 30/40', () => {
  const { byKey } = points({ skills: ['Communication', 'MS Excel', 'Sales'] }, {});
  assert.equal(byKey.skills, 30);
});

test('experience: exact band = 20, adjacent band = 10', () => {
  assert.equal(points({ experienceYears: 3 }, {}).byKey.experience, 20);
  assert.equal(points({ experienceYears: 1.5 }, {}).byKey.experience, 10);
  assert.equal(points({ experienceYears: 1 }, { experience: '2–5 yrs' }).byKey.experience, 10);
});

test('location: same city = 15, same state different city = 7, other state = 0', () => {
  assert.equal(points({ city: 'Chennai' }, {}).byKey.location, 15);
  assert.equal(points({ city: 'Coimbatore' }, {}).byKey.location, 7);
  assert.equal(points({ city: 'Coimbatore, Tamil Nadu' }, { city: 'Chennai' }).byKey.location, 7);
  assert.equal(points({ city: 'Mumbai' }, {}).byKey.location, 0);
});

test('language: all = 15, 1 of 2 = 7', () => {
  assert.equal(points({ languages: ['English', 'Tamil'] }, {}).byKey.language, 15);
  assert.equal(points({ languages: ['English'] }, {}).byKey.language, 7);
});

test('total equals the sum of factor points', () => {
  const { match, byKey } = points({ city: 'Coimbatore', languages: ['English'], experienceYears: 1.5 }, {});
  const sum = byKey.skills + byKey.experience + byKey.location + byKey.language + byKey.education;
  assert.equal(match.score, sum);
  assert.equal(sum, 40 + 10 + 7 + 7 + 10);
});
