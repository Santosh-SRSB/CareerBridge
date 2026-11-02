import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATS_JOB_MATCH_WEIGHTS,
  applyAtsMatchScoreGates,
  toAtsMatchBreakdown,
  type JobMatch,
} from './marketplace';

test('handbook match weights Skills 40 Experience 20 Location 15 Language 15 Education 10', () => {
  assert.equal(ATS_JOB_MATCH_WEIGHTS.skills, 40);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.experience, 20);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.location, 15);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.language, 15);
  assert.equal(ATS_JOB_MATCH_WEIGHTS.education, 10);
  const sum = Object.values(ATS_JOB_MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
});

test('zero skills uses actual factor total, only soft-caps under 60', () => {
  assert.equal(
    applyAtsMatchScoreGates(60, {
      skillsPoints: 0,
      experiencePoints: 20,
      locationPoints: 15,
      languagePoints: 15,
      educationPoints: 10,
    }),
    59,
  );
  assert.equal(
    applyAtsMatchScoreGates(50, {
      skillsPoints: 0,
      experiencePoints: 10,
      locationPoints: 15,
      languagePoints: 15,
      educationPoints: 10,
    }),
    50,
  );
  assert.equal(
    applyAtsMatchScoreGates(80, {
      skillsPoints: 40,
      experiencePoints: 20,
      locationPoints: 15,
      languagePoints: 5,
      educationPoints: 0,
    }),
    80,
  );
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

test('toAtsMatchBreakdown soft-caps ring score when skills are 0 but keeps factor total', () => {
  const fullNonSkills: JobMatch = {
    score: 60,
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
  assert.equal(full.score, 59);
  assert.equal(full.factors.find((f) => f.key === 'skills')?.score, 0);
  assert.equal(full.factors.find((f) => f.key === 'experience')?.score, 20);

  const halfExp: JobMatch = {
    ...fullNonSkills,
    score: 50,
    experienceScore: 50,
  };
  const half = toAtsMatchBreakdown(halfExp);
  assert.equal(half.score, 50);
  assert.equal(half.factors.find((f) => f.key === 'experience')?.score, 10);
});
