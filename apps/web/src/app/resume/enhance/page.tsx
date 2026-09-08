'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResumeEnhanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/resume');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Opening resume builder…
    </main>
  );
}
