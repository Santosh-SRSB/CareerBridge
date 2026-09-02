'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingInterestsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/education');
  }, [router]);

  return null;
}
