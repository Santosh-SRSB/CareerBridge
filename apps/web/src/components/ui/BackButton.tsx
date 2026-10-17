'use client';

import { useRouter } from 'next/navigation';
import { goToReturnTo, peekReturnTo } from '@/lib/nav-return';

export function BackButton({
  href,
  fallback = '/dashboard',
  className = '',
  light = false,
}: {
  href?: string;
  fallback?: string;
  className?: string;
  light?: boolean;
}) {
  const router = useRouter();

  function goBack() {
    if (href) {
      router.push(href);
      return;
    }
    if (peekReturnTo()) {
      goToReturnTo(router, fallback);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`cb-back-btn ${light ? 'cb-back-btn-light' : ''} ${className}`.trim()}
    >
      ← Back
    </button>
  );
}
