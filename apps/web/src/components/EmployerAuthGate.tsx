'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { postAuthPath } from '@/lib/phone';
import { clearSession, getAccessToken, getRefreshToken, getStoredUser, isEmployerRole, saveSession } from '@/lib/session';

function isPublicEmployerPath(pathname: string) {
  return pathname === '/employer/register' || pathname.startsWith('/employer/register/');
}

export function EmployerAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isPublicEmployerPath(pathname)) {
      setAllowed(true);
      return;
    }

    const token = getAccessToken();
    const refreshToken = getRefreshToken();
    const user = getStoredUser();

    if (!token || !refreshToken || !user) {
      clearSession();
      router.replace(`/login?role=employer&next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!isEmployerRole(user.role)) {
      router.replace(postAuthPath(user));
      return;
    }

    // Keep middleware cookie in sync for authenticated employer sessions.
    saveSession({
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 0,
      user,
    });
    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted">
        Checking authentication...
      </main>
    );
  }

  return <>{children}</>;
}
