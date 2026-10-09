import type { ReactNode } from 'react';
import '@/app/candidate-theme.css';

export function CandidateTheme({ children }: { children: ReactNode }) {
  return <div className="cb-cand">{children}</div>;
}
