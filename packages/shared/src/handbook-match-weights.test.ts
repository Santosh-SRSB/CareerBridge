import assert from 'node:assert/strict';
import test from 'node:test';
import { ATS_JOB_MATCH_WEIGHTS, toAtsMatchBreakdown, type JobMatch } from './marketplace';

test('handbook match weights Skills 40 Experience 20 Location 15 Language 15 Education 10', () => {
  assert.equal(ATS_JOB_MATCH_WEIGHTS.skills, 40);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.experience, 20);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.location, 15);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.language, 15);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.education, 10);
  const sum = Object.values(ATS_JOB_MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
});

test('toAtsMatchBreakdown exposes handbook factors', () => {
  const match: JobMatch = {
    score: 80,
    skillScore: 100,
    experienceScore: 100,
    educationScore: 100,
    locationScore: 100,
    languageScore: 100,
    preferredSkillScore: 0,
    resumeQualityScore: 0,
    categoryScore: 0,
    reasons: [],
    gaps: [],
    recommendations: [],
  };
  const breakdown = toAtsMatchBreakdown(match);
  assert.deepEqual(
    breakdown.factors.map((f) => f.key),
    ['skills', 'experience', 'location', 'language', 'education'],
  );
  assert.equal(breakdown.factors.find((f) => f.key === 'skills')?.max, 40);
  assert.equal(breakdown.factors.find((f) => f.key === 'language')?.max, 15);
});
