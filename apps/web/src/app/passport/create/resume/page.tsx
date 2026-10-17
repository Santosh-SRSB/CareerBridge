'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old drop-resume / card chooser — use /onboarding/complete only. */
export default function PassportCreateResumeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/complete');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
      Opening resume options…
    </main>
  );
}
