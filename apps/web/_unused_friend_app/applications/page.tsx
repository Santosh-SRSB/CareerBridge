'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ApplicationRecord } from '@careerbridge/shared';
import { listApplications } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { StatusBadge } from '@/components/AppNav';

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listApplications().then(setItems).finally(() => setLoading(false));
  }, []);

  return (
    <CandidateShell>
      <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">My applications</h1>
      <p className="mt-2 text-muted">Track every application from applied to interview.</p>
      {loading ? <p className="text-muted">Loading your applications...</p> : null}
      {!loading && !items.length ? (
        <p className="text-muted">You haven&apos;t applied yet. Explore jobs to get started.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={`/applications/${item.id}`} className="cb-lift-card block min-w-0 p-4 sm:p-5">
            <h2 className="break-words text-lg font-bold text-primary">{item.job.title}</h2>
            <p className="mt-1 text-muted">{item.job.companyName}</p>
            <div className="mt-4">
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-3 text-sm text-muted">Applied {new Date(item.createdAt).toLocaleDateString()}</p>
          </Link>
        ))}
      </div>
    </CandidateShell>
  );
}
