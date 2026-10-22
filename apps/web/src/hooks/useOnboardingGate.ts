'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { onboardingGateRedirect, type OnboardingStep } from '@/lib/onboarding-flow';

export function useOnboardingGate(step: OnboardingStep) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || onboardingGateRedirect(stored) === '/login') {
      router.replace('/login');
      return;
    }

    fetchMe()
      .then((me) => {
        // Completion flags only move false → true; never let a stale false wipe a local true.
        const onboardingCompleted = Boolean(me.onboardingCompleted || stored.onboardingCompleted);
        const dashboardReached = Boolean(me.dashboardReached || stored.dashboardReached);
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted,
          dashboardReached,
        });
        const dest = onboardingGateRedirect({ onboardingCompleted, dashboardReached });
        if (dest) {
          router.replace(dest);
          return;
        }
        setReady(true);
      })
      .catch(() => {
        const dest = onboardingGateRedirect(stored);
        if (dest) {
          router.replace(dest);
          return;
        }
        setReady(true);
      });
  }, [router, step]);

  return ready;
}
