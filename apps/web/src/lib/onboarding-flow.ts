export const POST_REGISTRATION_PATH = '/onboarding';

export const ONBOARDING_STEP_PATHS = [
  '/onboarding',
  '/onboarding/name',
  '/onboarding/education',
  '/onboarding/experience',
] as const;

export type OnboardingStep = 1 | 2 | 3 | 4;

export function nextOnboardingStepPath(step: OnboardingStep): string {
  if (step >= 4) return '/dashboard';
  return ONBOARDING_STEP_PATHS[step];
}
