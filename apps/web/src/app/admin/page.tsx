'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, isPlatformRole } from '@/lib/session';

/** Legacy /admin → live SRSB admin portal */
export default function AdminRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    router.replace(user && isPlatformRole(user.role) ? '/srsbaadmin/dashboard' : '/srsbaadmin');
  }, [router]);

  return <main className="p-8 text-sm text-muted">Opening admin portal…</main>;
}
