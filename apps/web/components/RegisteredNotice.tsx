'use client';

import { useSearchParams } from 'next/navigation';

export function RegisteredNotice() {
  const params = useSearchParams();
  if (params.get('registered') !== '1') return null;
  return (
    <p className="mb-6 rounded-md bg-primary-soft p-3 text-sm font-medium text-primary">
      Account created. Sign in with your email or mobile number and password.
    </p>
  );
}
