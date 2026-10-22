export const POST_REGISTRATION_PATH = '/onboarding';

/** Resolves the correct onboarding/dashboard destination after auth. */
export const ONBOARDING_CONTINUE_PATH = '/onboarding/continue';

/** 1 Location · 2 Employment status · 3 Job preferences · 4 Skills */
export const ONBOARDING_STEP_PATHS = [
  '/onboarding',
  '/onboarding/status',
  '/onboarding/preferences',
  '/onboarding/skills',
] as const;

/** After step 4 (answered or skipped) → Student Dossier → resume upload/build → wizard → dashboard. */
export const ONBOARDING_FINISH_PATH = '/onboarding/dossier';

export type OnboardingStep = 1 | 2 | 3 | 4;

export type OnboardingResumeProfile = {
  state?: string | null;
  city?: string | null;
  preferredWorkCity?: string | null;
  employmentStatus?: string | null;
  careerInterests?: string[] | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  preferredJobTypes?: string[] | null;
  onboardingSkippedSteps?: number[] | null;
  onboardingCompleted?: boolean;
  dashboardReached?: boolean;
};

/**
 * Client onboarding-step gate: send unauthenticated or finished users away.
 * `null` means the current step may render (including a newly registered candidate).
 * Completed candidates go to the dashboard (not back through resume/profile steps).
 */
export function onboardingGateRedirect(
  user: { onboardingCompleted?: boolean; dashboardReached?: boolean } | null,
): '/login' | '/dashboard' | null {
  if (!user) return '/login';
  if (user.dashboardReached || user.onboardingCompleted) return '/dashboard';
  return null;
}

/**
 * Pick where a candidate should land:
 * - Dashboard if they finished onboarding or have opened it at least once
 * - Otherwise the first step that is neither answered nor skipped
 */
export function resolveCandidateResumePath(profile: OnboardingResumeProfile): string {
  if (profile.dashboardReached || profile.onboardingCompleted) return '/dashboard';
  const skipped = new Set(profile.onboardingSkippedSteps ?? []);

  const hasLocation = Boolean(
    profile.state?.trim() || profile.city?.trim() || profile.preferredWorkCity?.trim(),
  );
  if (!hasLocation && !skipped.has(1)) return ONBOARDING_STEP_PATHS[0];

  if (!profile.employmentStatus && !skipped.has(2)) return ONBOARDING_STEP_PATHS[1];

  const hasPreferences =
    Boolean(profile.careerInterests?.length) ||
    Boolean(profile.preferredJobTypes?.length) ||
    profile.expectedSalaryMin != null ||
    profile.expectedSalaryMax != null;
  if (!hasPreferences && !skipped.has(3)) return ONBOARDING_STEP_PATHS[2];

  return ONBOARDING_STEP_PATHS[3];
}

export function nextOnboardingStepPath(step: OnboardingStep): string {
  if (step === 4) return ONBOARDING_FINISH_PATH;
  return ONBOARDING_STEP_PATHS[step as 1 | 2 | 3];
}

/** Skipped list after answering (`skipped=false`) or skipping (`skipped=true`) a step. */
export function withSkippedStep(current: number[] | null | undefined, step: OnboardingStep, skipped: boolean) {
  const set = new Set((current ?? []).filter((n) => n >= 1 && n <= 4));
  if (skipped) set.add(step);
  else set.delete(step);
  return [...set].sort((a, b) => a - b);
}
