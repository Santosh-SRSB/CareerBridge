'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ApplicationRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { ApplicationProgressTrack } from '@/components/marketplace/ApplicationProgressTrack';
import { fetchApplications } from '@/lib/candidate-marketplace-api';

function formatAppliedDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Applications</h1>

        {loading ? <p className="text-sm text-slate-500">Loading your applications...</p> : null}

        {!loading && !items.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">You haven&apos;t applied yet.</p>
            <Link href="/jobs" className="mt-3 inline-block text-sm font-bold text-[#0a2e2c] hover:underline">
              Find jobs
            </Link>
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/applications/${item.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0a2e2c]/30"
            >
              <h2 className="text-base font-extrabold text-slate-900">{item.job.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">{item.job.companyName}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Applied: {formatAppliedDate(item.createdAt)}
              </p>
              <div className="mt-4">
                <ApplicationProgressTrack application={item} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </CandidateAppShell>
  );
}
