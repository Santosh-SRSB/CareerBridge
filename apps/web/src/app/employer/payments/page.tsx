'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmployerShellFallback } from '@/components/EmployerPortal';

/** Payments are disabled — platform is free for now. */
export default function EmployerPaymentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/employer');
  }, [router]);

  return (
    <EmployerShellFallback title="Payments">
      <div className="ep-create">
        <p className="text-sm text-muted">Hiring is free for now. Redirecting…</p>
      </div>
    </EmployerShellFallback>
  );
}
