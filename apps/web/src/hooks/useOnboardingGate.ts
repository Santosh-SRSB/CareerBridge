'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import type { OnboardingStep } from '@/lib/onboarding-flow';

export function useOnboardingGate(step: OnboardingStep) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }

    fetchMe()
      .then((me) => {
        const onboardingCompleted = me.onboardingCompleted ?? stored.onboardingCompleted;
        const dashboardReached = me.dashboardReached ?? stored.dashboardReached;
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted,
          dashboardReached,
        });
        // Completed users must not bounce on step pages when dashboardReached is still false.
        if (dashboardReached) {
          router.replace('/dashboard');
          return;
        }
        if (onboardingCompleted) {
          router.replace('/onboarding/complete');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (stored.dashboardReached) {
          router.replace('/dashboard');
          return;
        }
        if (stored.onboardingCompleted) {
          router.replace('/onboarding/complete');
          return;
        }
        setReady(true);
      });
  }, [router, step]);

  return ready;
}
