'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy step URL — work status is now onboarding step 2. */
export default function OnboardingExperienceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/status');
  }, [router]);

  return null;
}
