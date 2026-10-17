'use client';

import { useEffect } from 'react';
import { getAccessToken } from '@/lib/session';

const AUTH_COOKIE = 'cb_auth';

/** Keeps the middleware auth cookie aligned with localStorage sessions. */
export function AuthCookieSync() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (getAccessToken()) {
      document.cookie = `${AUTH_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
    } else {
      document.cookie = `${AUTH_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
    }
  }, []);
  return null;
}
