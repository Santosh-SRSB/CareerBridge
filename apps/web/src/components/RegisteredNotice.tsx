'use client';

import { useSearchParams } from 'next/navigation';

export function RegisteredNotice() {
  const params = useSearchParams();
  const text =
    params.get('registered') === '1'
      ? 'Account created. Sign in with your email or mobile number and password.'
      : params.get('reset') === '1'
        ? 'Password updated. Sign in with your new password.'
        : null;
  if (!text) return null;
  return (
    <p className="mb-6 rounded-md bg-primary-soft p-3 text-sm font-medium text-primary" role="status">
      {text}
    </p>
  );
}
