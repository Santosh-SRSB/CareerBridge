'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy AI interview setup redirects to the simplified mock interview flow. */
export default function AiInterviewRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/interviews/mock');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Redirecting to Mock Interview…
    </main>
  );
}
