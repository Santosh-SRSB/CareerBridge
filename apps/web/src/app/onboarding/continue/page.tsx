'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCandidateMe } from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { resolveCandidateResumePath } from '@/lib/onboarding-flow';

/** After login / home click — send the candidate to their current phase. */
export default function OnboardingContinuePage() {
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (stored.dashboardReached || stored.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }

    getCandidateMe()
      .then((profile) => {
        const onboardingCompleted = Boolean(profile.onboardingCompleted || stored.onboardingCompleted);
        const dashboardReached = Boolean(profile.dashboardReached || stored.dashboardReached);
        patchStoredUser({
          firstName: profile.firstName,
          onboardingCompleted,
          dashboardReached,
        });
        router.replace(
          resolveCandidateResumePath({
            ...profile,
            onboardingCompleted,
            dashboardReached,
          }),
        );
      })
      .catch(() => {
        if (stored.onboardingCompleted || stored.dashboardReached) {
          router.replace('/dashboard');
          return;
        }
        router.replace('/onboarding');
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
      Continuing where you left off…
    </main>
  );
}
