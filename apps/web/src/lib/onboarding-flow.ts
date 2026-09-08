export const POST_REGISTRATION_PATH = '/onboarding';

/** Resolves the correct onboarding/dashboard destination after auth. */
export const ONBOARDING_CONTINUE_PATH = '/onboarding/continue';

export const ONBOARDING_STEP_PATHS = [
  '/onboarding',
  '/onboarding/name',
  '/onboarding/education',
  '/onboarding/experience',
] as const;

export type OnboardingStep = 1 | 2 | 3 | 4;

export type OnboardingResumeProfile = {
  state?: string | null;
  city?: string | null;
  preferredWorkCity?: string | null;
  careerInterests?: string[] | null;
  highestEducation?: string | null;
  education?: unknown[] | null;
  hasExperience?: string | null;
  onboardingCompleted?: boolean;
  dashboardReached?: boolean;
};

/**
 * Pick where a candidate should land:
 * - Dashboard if they have opened it at least once
 * - Resume choice if core onboarding is done but dashboard not opened yet
 * - Otherwise the first incomplete onboarding step
 */
export function resolveCandidateResumePath(profile: OnboardingResumeProfile): string {
  if (profile.dashboardReached) return '/dashboard';
  if (profile.onboardingCompleted) return '/onboarding/complete';

  const hasLocation = Boolean(
    profile.state?.trim() || profile.city?.trim() || profile.preferredWorkCity?.trim(),
  );
  if (!hasLocation) return ONBOARDING_STEP_PATHS[0];

  if (!(profile.careerInterests && profile.careerInterests.length > 0)) {
    return ONBOARDING_STEP_PATHS[1];
  }

  const hasEducation =
    Boolean(profile.highestEducation?.trim()) || (profile.education?.length ?? 0) > 0;
  if (!hasEducation) return ONBOARDING_STEP_PATHS[2];

  return ONBOARDING_STEP_PATHS[3];
}

export function nextOnboardingStepPath(step: OnboardingStep): string {
  if (step >= 4) return '/onboarding/complete';
  const paths: Record<Exclude<OnboardingStep, 4>, string> = {
    1: ONBOARDING_STEP_PATHS[1],
    2: ONBOARDING_STEP_PATHS[2],
    3: ONBOARDING_STEP_PATHS[3],
  };
  return paths[step as Exclude<OnboardingStep, 4>];
}
