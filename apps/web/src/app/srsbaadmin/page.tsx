'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, isPlatformRole } from '@/lib/session';

/** Legacy /srsbaadmin → /adminsrsb */
export default function LegacySrsbAdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    const user = getStoredUser();
    router.replace(user && isPlatformRole(user.role) ? '/adminsrsb/dashboard' : '/adminsrsb');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] text-sm text-slate-600">
      Redirecting to admin portal…
    </main>
  );
}
