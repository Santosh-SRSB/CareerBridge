'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function ClientOnly({ children, minHeight = 220 }: { children: ReactNode; minHeight?: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ minHeight }} aria-hidden />;
  }

  return children;
}
