'use client';

import { Suspense } from 'react';
import SuperAdminDashboardInner from './dashboard-inner';

export default function SrsbAdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#eeeeee] p-8 text-sm text-[#888]">Loading admin portal…</main>
      }
    >
      <SuperAdminDashboardInner />
    </Suspense>
  );
}
