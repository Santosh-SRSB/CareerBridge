'use client';

import type { ReactNode } from 'react';
import { EmployerAuthGate } from '@/components/EmployerAuthGate';
import '../employer-pro.css';

export default function EmployerLayout({ children }: { children: ReactNode }) {
  return <EmployerAuthGate>{children}</EmployerAuthGate>;
}
