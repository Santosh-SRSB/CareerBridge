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
  const paths: Record<Exclude<OnboardingStep, 4>, string> = {
    1: ONBOARDING_STEP_PATHS[1],
    2: ONBOARDING_STEP_PATHS[2],
    3: ONBOARDING_STEP_PATHS[3],
  };
  return paths[step as Exclude<OnboardingStep, 4>];
}
