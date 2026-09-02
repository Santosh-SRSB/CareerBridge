'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminDashboard } from '@careerbridge/shared';
import { getAdminDashboard, getAdminList, logout } from '@/lib/api';
import { Logo } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';

const TABS = ['dashboard', 'candidates', 'employers', 'jobs', 'applications', 'skills'] as const;

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('dashboard');
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null);
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    getAdminDashboard()
      .then(setMetrics)
      .catch(() => router.replace('/login/password'));
  }, [router]);

  useEffect(() => {
    if (tab === 'dashboard') return;
    getAdminList(tab).then(setRows).catch(() => setRows([]));
  }, [tab]);

  if (!metrics) return <main className="p-8 text-muted">Loading admin dashboard...</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <BackButton fallback="/" />
        <Logo />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-primary">Platform operations</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-sm px-3 py-2 text-sm font-semibold ${tab === item ? 'bg-primary text-accent' : 'bg-surface text-primary'}`}>
            {item}
          </button>
        ))}
      </div>
      {tab === 'dashboard' ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            ['Candidates', metrics.candidates],
            ['Active candidates', metrics.activeCandidates],
            ['Employers', metrics.employers],
            ['Open jobs', metrics.openJobs],
            ['Applications', metrics.applications],
            ['Interviews', metrics.interviews],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-2xl font-bold text-primary">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <pre className="mt-6 overflow-auto rounded-md bg-surface p-4 text-xs">{JSON.stringify(rows, null, 2)}</pre>
      )}
      <div className="mt-8 max-w-xs">
        <Button variant="secondary" onClick={async () => { await logout(); router.replace('/'); }}>Sign out</Button>
      </div>
    </main>
  );
}
