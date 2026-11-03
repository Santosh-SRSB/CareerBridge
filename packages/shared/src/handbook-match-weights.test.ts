import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATS_JOB_MATCH_WEIGHTS,
  applyAtsMatchScoreGates,
  toAtsMatchBreakdown,
  type JobMatch,
} from './marketplace';

test('match weights Skills 80 Experience 5 Location 5 Language 5 Education 5', () => {
  assert.equal(ATS_JOB_MATCH_WEIGHTS.skills, 80);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.experience, 5);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.location, 5);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.language, 5);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.education, 5);
  const sum = Object.values(ATS_JOB_MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
});

test('zero skills uses actual factor total, only soft-caps under 60', () => {
  assert.equal(
    applyAtsMatchScoreGates(20, {
      skillsPoints: 0,
      experiencePoints: 5,
      locationPoints: 5,
      languagePoints: 5,
      educationPoints: 5,
    }),
    20,
  );
  assert.equal(
    applyAtsMatchScoreGates(15, {
      skillsPoints: 0,
      experiencePoints: 0,
      locationPoints: 5,
      languagePoints: 5,
      educationPoints: 5,
    }),
    15,
  );
  assert.equal(
    applyAtsMatchScoreGates(90, {
      skillsPoints: 80,
      experiencePoints: 5,
      locationPoints: 5,
      languagePoints: 0,
      educationPoints: 0,
    }),
    90,
  );
});

test('toAtsMatchBreakdown exposes handbook factors', () => {
  const match: JobMatch = {
    score: 100,
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
  assert.equal(breakdown.factors.find((f) => f.key === 'skills')?.max, 80);
  assert.equal(breakdown.factors.find((f) => f.key === 'language')?.max, 5);
});

test('toAtsMatchBreakdown soft-caps ring score when skills are 0 but keeps factor total', () => {
  const fullNonSkills: JobMatch = {
    score: 20,
    skillScore: 0,
    experienceScore: 100,
    educationScore: 100,
    locationScore: 100,
    languageScore: 100,
    preferredSkillScore: 0,
    resumeQualityScore: 0,
    categoryScore: 0,
    reasons: [],
    gaps: ['Excel'],
    recommendations: [],
  };
  const full = toAtsMatchBreakdown(fullNonSkills);
  assert.equal(full.score, 20);
  assert.equal(full.factors.find((f) => f.key === 'skills')?.score, 0);
  assert.equal(full.factors.find((f) => f.key === 'experience')?.score, 5);

  const halfExp: JobMatch = {
    ...fullNonSkills,
    score: 18,
    experienceScore: 50,
  };
  const half = toAtsMatchBreakdown(halfExp);
  assert.equal(half.score, 18);
  assert.equal(half.factors.find((f) => f.key === 'experience')?.score, 3);
});
