'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy interview entry points redirect to the single MVP hub. */
export default function ClassicInterviewsRedirectPage() {
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
