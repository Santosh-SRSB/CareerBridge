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
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted: me.onboardingCompleted ?? stored.onboardingCompleted,
        });
        if (me.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (stored.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }
        setReady(true);
      });
  }, [router, step]);

  return ready;
}
