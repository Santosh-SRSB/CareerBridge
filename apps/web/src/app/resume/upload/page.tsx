'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Autofill upload now happens via popup on /onboarding/complete */
export default function ResumeUploadRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/complete');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
      Opening Autofill…
    </main>
  );
}
