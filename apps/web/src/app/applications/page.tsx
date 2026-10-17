'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ApplicationRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { ApplicationProgressTrack } from '@/components/marketplace/ApplicationProgressTrack';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { fetchApplications } from '@/lib/candidate-marketplace-api';
import { isUnauthorizedError } from '@/lib/client-errors';
function formatAppliedDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function jobInactive(item: ApplicationRecord) {
  const status = (item.job.status || '').toUpperCase();
  return Boolean(status) && status !== 'PUBLISHED';
}

type LoadState = 'loading' | 'ready' | 'error' | 'unauthorized';

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationRecord[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(() => {
    setState('loading');
    fetchApplications()
      .then((rows) => {
        setItems(rows);
        setState('ready');
      })
      .catch((err) => setState(isUnauthorizedError(err) ? 'unauthorized' : 'error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Applications</h1>

        {state === 'loading' ? <SkeletonList rows={3} label="Loading your applications..." /> : null}

        {state === 'error' ? (
          <ErrorState message="Something went wrong. We couldn't load your applications." onRetry={load} />
        ) : null}

        {state === 'unauthorized' ? (
          <ErrorState message="Your session has expired. Please sign in again to see your applications." />
        ) : null}

        {state === 'ready' && !items.length ? (
          <EmptyState
            title="You haven't applied yet."
            message="Browse jobs that match your Career Passport and apply in one tap."
            actionLabel="Find jobs"
            actionHref="/jobs"
          />
        ) : null}

        {state === 'ready' ? (
          <div className="space-y-4">
            {items.map((item) => {
              const inactive = jobInactive(item);
              return (
                <Link
                  key={item.id}
                  href={`/applications/${item.id}`}
                  className={`relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1A1FC4]/30 ${
                    inactive ? 'pointer-events-auto' : ''
                  }`}
                >
                  <div className={inactive ? 'blur-[2px] opacity-55' : undefined}>
                    <h2 className="text-base font-extrabold text-slate-900">{item.job.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{item.job.companyName}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      Applied: {formatAppliedDate(item.createdAt)}
                    </p>
                    <div className="mt-4">
                      <ApplicationProgressTrack application={item} />
                    </div>
                  </div>
                  {inactive ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/35">
                      <p className="rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-red-700 shadow-sm">
                        Job is no more Active
                      </p>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </CandidateAppShell>
  );
}
