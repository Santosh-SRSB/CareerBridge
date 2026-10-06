'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy step URL — education is captured in Career Passport; onboarding resumes at the first open step. */
export default function OnboardingEducationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/continue');
  }, [router]);

  return null;
}
