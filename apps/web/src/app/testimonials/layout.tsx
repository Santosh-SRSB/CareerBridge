import type { ReactNode } from 'react';
import { CandidateTheme } from '@/components/CandidateTheme';

export default function Layout({ children }: { children: ReactNode }) {
  return <CandidateTheme>{children}</CandidateTheme>;
}
