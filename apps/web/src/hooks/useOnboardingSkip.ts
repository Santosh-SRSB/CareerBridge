'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCandidateMe } from '@/lib/api';
import { patchStoredUser } from '@/lib/session';
import { nextOnboardingStepPath, withSkippedStep, type OnboardingStep } from '@/lib/onboarding-flow';

export const ONBOARDING_SAVE_ERROR = "We couldn't save your information. Please try again.";

/** "Skip for now": records the step as skipped (lowering profile completion) and moves on. */
export function useOnboardingSkip(step: OnboardingStep, skippedSteps: number[]) {
  const router = useRouter();
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState('');

  async function skip() {
    setSkipping(true);
    setSkipError('');
    try {
      await updateCandidateMe({
        onboardingSkippedSteps: withSkippedStep(skippedSteps, step, true),
        ...(step === 4 ? { onboardingCompleted: true } : {}),
      });
      if (step === 4) patchStoredUser({ onboardingCompleted: true });
      router.push(nextOnboardingStepPath(step));
    } catch {
      setSkipError(ONBOARDING_SAVE_ERROR);
    } finally {
      setSkipping(false);
    }
  }

  return { skip, skipping, skipError };
}
