'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const template = searchParams.get('template') || 'ats-minimal';
    const photo = searchParams.get('photo') === '1' ? '1' : '0';
    const source = searchParams.get('source') === 'passport' ? 'passport' : 'manual';
    router.replace(
      `/resume/builder/start?source=${source}&template=${encodeURIComponent(template)}&photo=${photo}`,
    );
  }, [router, searchParams]);

  return <p style={{ padding: 24 }}>Opening resume builder…</p>;
}

/** Legacy route — use /resume/builder/start */
export default function ManualResumeLegacyRedirect() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Opening resume builder…</p>}>
      <RedirectInner />
    </Suspense>
  );
}
