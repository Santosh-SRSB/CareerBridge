import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeResumeContent, extractFacts, validateRewrite } from './ats';
import type { ResumeContent } from './marketplace';

const base: ResumeContent = {
  fullName: 'Priya Sharma',
  city: 'Pune',
  phone: '9999999999',
  summary: 'Used React.',
  skills: ['React'],
  education: [{ qualification: 'B.Com', institution: 'Pune University', yearCompleted: 2022 }],
  experiences: [{ company: 'ABC', jobTitle: 'Developer', description: 'Used React.', isInternship: false }],
  languages: ['English'],
};

test('same React wording passes', () => {
  const facts = extractFacts(base);
  const result = validateRewrite('Used React.', 'Used React.', facts);
  assert.equal(result.result, 'PASS');
});

test('developed React applications passes', () => {
  const facts = extractFacts({ ...base, experiences: [{ ...base.experiences[0], description: 'Worked on React applications.' }] });
  const result = validateRewrite('Worked on React applications.', 'Developed React applications.', facts);
  assert.equal(result.result, 'PASS');
});

test('invented team size fails', () => {
  const facts = extractFacts(base);
  const result = validateRewrite('Used React.', 'Led a team of 20 React developers.', facts);
  assert.equal(result.result, 'FAIL');
});

test('invented percentage fails', () => {
  const facts = extractFacts({
    ...base,
    experiences: [{ company: 'ABC', jobTitle: 'DBA', description: 'Used PostgreSQL.', isInternship: false }],
  });
  const result = validateRewrite('Used PostgreSQL.', 'Reduced PostgreSQL query time by 40%.', facts);
  assert.equal(result.result, 'FAIL');
});

test('full resume scores higher than empty resume', () => {
  const strong = analyzeResumeContent(base, 'Priya Sharma\n9999999999\nPune\nUsed React at ABC as Developer');
  const weak = analyzeResumeContent({
    fullName: '',
    city: null,
    phone: null,
    summary: '',
    skills: [],
    education: [],
    experiences: [],
    languages: [],
  });
  assert.ok(strong.score > weak.score);
  assert.equal(strong.scoreType, 'ATS_READINESS');
  assert.ok(strong.sections.length === 11);
});
