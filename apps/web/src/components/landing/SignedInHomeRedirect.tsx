'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, homePathForUser } from '@/lib/session';

/** Signed-in users should land on their dashboard, not the marketing homepage. */
export function SignedInHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.id) return;
    const path = homePathForUser(user);
    if (path !== '/') router.replace(path);
  }, [router]);

  return null;
}
