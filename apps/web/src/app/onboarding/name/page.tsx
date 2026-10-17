'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy step URL (domain) — onboarding now resumes at the first open step. */
export default function OnboardingNameRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/continue');
  }, [router]);

  return null;
}
