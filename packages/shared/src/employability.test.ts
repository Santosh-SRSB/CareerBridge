import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEmployabilityScore, employabilityBand } from './employability';

test('employability score weights real profile signals', () => {
  const result = computeEmployabilityScore({
    profileCompletion: 100,
    bestResumeAtsScore: 80,
    mockInterviewScores: [70, 90, 50, 10],
    skillsCount: 4,
    hasWorkExperience: true,
    projectsCount: 0,
    certificationsCount: 1,
  });
  // 25 + 20 + 14 (avg of the 3 most recent) + 7.5 + 10 + 2.5
  assert.equal(result.score, 79);
  assert.equal(result.band, 'Good');
  assert.equal(result.ready, true);
  assert.equal(result.components.find((c) => c.key === 'interview')?.score, 70);
  assert.equal(result.components.find((c) => c.key === 'profile')?.points, 25);
  assert.equal(result.components.reduce((sum, c) => sum + c.weight, 0), 100);
});

test('missing resume and interviews score zero with a tip instead of a guess', () => {
  const result = computeEmployabilityScore({
    profileCompletion: 30,
    bestResumeAtsScore: null,
    mockInterviewScores: [],
    skillsCount: 0,
    hasWorkExperience: false,
    projectsCount: 0,
    certificationsCount: 0,
  });
  assert.equal(result.score, 8);
  assert.equal(result.band, 'Low');
  assert.equal(result.ready, false);
  const resume = result.components.find((c) => c.key === 'resume');
  assert.equal(resume?.score, 0);
  assert.equal(resume?.tip, 'Create a resume and check its ATS score.');
  assert.equal(result.components.find((c) => c.key === 'interview')?.tip, 'Complete an AI mock interview.');
});

test('projects count as partial experience for freshers', () => {
  const result = computeEmployabilityScore({
    profileCompletion: 100,
    bestResumeAtsScore: 100,
    mockInterviewScores: [100],
    skillsCount: 20,
    hasWorkExperience: false,
    projectsCount: 2,
    certificationsCount: 5,
  });
  assert.equal(result.components.find((c) => c.key === 'experience')?.score, 60);
  assert.equal(result.components.find((c) => c.key === 'skills')?.score, 100);
  assert.equal(result.score, 96);
});

test('employability bands', () => {
  assert.equal(employabilityBand(39), 'Low');
  assert.equal(employabilityBand(40), 'Developing');
  assert.equal(employabilityBand(60), 'Good');
  assert.equal(employabilityBand(80), 'Strong');
});
