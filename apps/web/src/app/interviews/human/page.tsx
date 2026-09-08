'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Human mock room entry consolidated into Interviews hub for MVP clarity. */
export default function HumanInterviewsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/interviews');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Redirecting to Interviews…
    </main>
  );
}
