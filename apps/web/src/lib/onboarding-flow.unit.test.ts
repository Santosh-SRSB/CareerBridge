import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nextOnboardingStepPath,
  onboardingGateRedirect,
  resolveCandidateResumePath,
  withSkippedStep,
} from './onboarding-flow';

describe('onboarding flow', () => {
  it('steps run Location → Status → Preferences → Skills → Student Dossier', () => {
    assert.equal(nextOnboardingStepPath(1), '/onboarding/status');
    assert.equal(nextOnboardingStepPath(2), '/onboarding/preferences');
    assert.equal(nextOnboardingStepPath(3), '/onboarding/skills');
    assert.equal(nextOnboardingStepPath(4), '/onboarding/dossier');
    assert.notEqual(nextOnboardingStepPath(4), '/dashboard');
  });

  it('resumes at the first step that is neither answered nor skipped', () => {
    assert.equal(resolveCandidateResumePath({}), '/onboarding');
    assert.equal(resolveCandidateResumePath({ onboardingSkippedSteps: [1] }), '/onboarding/status');
    assert.equal(
      resolveCandidateResumePath({ state: 'Kerala', employmentStatus: 'FRESHER' }),
      '/onboarding/preferences',
    );
    assert.equal(
      resolveCandidateResumePath({ state: 'Kerala', onboardingSkippedSteps: [2, 3] }),
      '/onboarding/skills',
    );
    assert.equal(resolveCandidateResumePath({ onboardingCompleted: true }), '/dashboard');
    assert.equal(resolveCandidateResumePath({ dashboardReached: true }), '/dashboard');
  });

  it('lets a newly registered candidate stay on onboarding and sends finished users to dashboard', () => {
    assert.equal(onboardingGateRedirect(null), '/login');
    assert.equal(onboardingGateRedirect({ onboardingCompleted: false, dashboardReached: false }), null);
    assert.equal(onboardingGateRedirect({ onboardingCompleted: true, dashboardReached: false }), '/dashboard');
    assert.equal(onboardingGateRedirect({ onboardingCompleted: true, dashboardReached: true }), '/dashboard');
  });

  it('answering a step clears its skipped flag; skipping adds it once', () => {
    assert.deepEqual(withSkippedStep([3], 1, true), [1, 3]);
    assert.deepEqual(withSkippedStep([1, 3], 1, true), [1, 3]);
    assert.deepEqual(withSkippedStep([1, 3], 1, false), [3]);
    assert.deepEqual(withSkippedStep(null, 4, false), []);
  });
});
