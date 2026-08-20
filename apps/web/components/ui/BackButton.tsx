'use client';

import { useRouter } from 'next/navigation';

export function BackButton({
  href,
  fallback = '/dashboard',
  className = '',
}: {
  href?: string;
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button type="button" onClick={goBack} className={`cb-back-btn ${className}`.trim()}>
      ← Back
    </button>
  );
}
