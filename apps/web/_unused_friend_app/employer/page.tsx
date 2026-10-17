'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EmployerDashboard } from '@careerbridge/shared';
import { getEmployerDashboard, logout } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import { StatusBadge } from '@/components/AppNav';
import { Button } from '@/components/ui/Button';

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<EmployerDashboard | null>(null);

  useEffect(() => {
    getEmployerDashboard().then(setData).catch(() => router.replace('/login?role=employer'));
  }, [router]);

  if (!data) return <main className="p-8 text-muted">Loading employer dashboard...</main>;

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Hiring dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          ['Open jobs', data.openJobs],
          ['Applications', data.applications],
          ['Shortlisted', data.shortlisted],
          ['Interviews', data.interviews],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-bold text-primary">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-md bg-surface p-5 shadow-sm">
        <p className="font-semibold text-primary">Recent applications</p>
        {data.recent.map((item) => (
          <div key={item.applicationId} className="mt-3 flex items-center justify-between border-t border-primary/10 pt-3">
            <div>
              <p className="font-semibold text-primary">{item.candidateName}</p>
              <p className="text-sm text-muted">{item.jobTitle}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </section>
      <Link href="/employer/jobs/new" className="mt-6 inline-flex rounded-sm bg-primary px-4 py-3 font-semibold text-accent">Create Job</Link>
      <div className="mt-4">
        <Button variant="secondary" onClick={async () => { await logout(); router.replace('/'); }}>Sign out</Button>
      </div>
      <EmployerNav />
    </main>
  );
}
