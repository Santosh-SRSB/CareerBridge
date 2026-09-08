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
    if (stored.dashboardReached) {
      router.replace('/dashboard');
      return;
    }

    getCandidateMe()
      .then((profile) => {
        patchStoredUser({
          firstName: profile.firstName,
          onboardingCompleted: profile.onboardingCompleted,
          dashboardReached: profile.dashboardReached ?? false,
        });
        router.replace(resolveCandidateResumePath(profile));
      })
      .catch(() => {
        if (stored.onboardingCompleted) {
          router.replace('/onboarding/complete');
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
