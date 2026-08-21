'use client';

import { type ReactNode } from 'react';

export function TiltCard({ children }: { children: ReactNode }) {
  return (
    <div className="cb-glass-card cb-auth-portal relative overflow-hidden shadow-[0_28px_70px_rgba(7,28,34,0.28)]">
      {children}
    </div>
  );
}
