import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPANY_SIZES, isCompanySize, parseLinkedinUrl } from './company-profile';
import {
  activeJobLimitReached,
  candidateViewCreditsLeft,
  parseEmployerPlanSettings,
} from './employer-plan';

test('company size options match the handbook', () => {
  assert.deepEqual([...COMPANY_SIZES], ['1-10', '11-50', '51-200', '201-500', '500+']);
  assert.equal(isCompanySize('11-50'), true);
  assert.equal(isCompanySize('10-20'), false);
  assert.equal(isCompanySize(''), false);
});

test('LinkedIn URL is optional, must be on linkedin.com, and is normalised to https', () => {
  assert.deepEqual(parseLinkedinUrl(''), { ok: true, value: null });
  assert.deepEqual(parseLinkedinUrl('   '), { ok: true, value: null });
  assert.deepEqual(parseLinkedinUrl('linkedin.com/company/acme'), {
    ok: true,
    value: 'https://linkedin.com/company/acme',
  });
  assert.deepEqual(parseLinkedinUrl('http://www.linkedin.com/company/acme'), {
    ok: true,
    value: 'https://www.linkedin.com/company/acme',
  });
  for (const bad of ['https://evil.example/linkedin.com', 'javascript:alert(1)', 'https://linkedin.com.evil.io/x', 'not a url']) {
    assert.equal(parseLinkedinUrl(bad).ok, false, bad);
  }
});

test('plan settings: defaults apply to missing or invalid values; only 0 means unlimited', () => {
  assert.deepEqual(parseEmployerPlanSettings({}), { starterActiveJobLimit: 5, starterCandidateViewCredits: 100 });
  assert.deepEqual(
    parseEmployerPlanSettings({ 'billing.starterActiveJobLimit': '0', 'billing.starterCandidateViewCredits': 'abc' }),
    { starterActiveJobLimit: 0, starterCandidateViewCredits: 100 },
  );
  assert.deepEqual(
    parseEmployerPlanSettings({ 'billing.starterActiveJobLimit': '-3', 'billing.starterCandidateViewCredits': '25.9' }),
    { starterActiveJobLimit: 5, starterCandidateViewCredits: 25 },
  );
});

test('plan usage helpers', () => {
  const base = { plan: 'STARTER' as const, period: '2026-09', activeJobs: 5, activeJobLimit: 5, candidateViews: 40, candidateViewCredits: 100 };
  assert.equal(activeJobLimitReached(base), true);
  assert.equal(activeJobLimitReached({ ...base, activeJobs: 4 }), false);
  assert.equal(activeJobLimitReached({ ...base, activeJobLimit: 0, activeJobs: 99 }), false);
  assert.equal(candidateViewCreditsLeft(base), 60);
  assert.equal(candidateViewCreditsLeft({ ...base, candidateViews: 150 }), 0);
  assert.equal(candidateViewCreditsLeft({ ...base, candidateViewCredits: 0 }), null);
});
