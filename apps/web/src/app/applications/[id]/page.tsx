'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ApplicationRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { ApplicationProgressTrack } from '@/components/marketplace/ApplicationProgressTrack';
import { StatusBadge } from '@/components/AppNav';
import { fetchApplication } from '@/lib/candidate-marketplace-api';

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    fetchApplication(params.id).then(setApplication);
  }, [params.id]);

  if (!application) {
    return (
      <CandidateAppShell activeTab="applications">
        <p className="text-slate-500">Loading application timeline...</p>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/applications" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← My Applications
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{application.job.title}</h1>
        <p className="text-sm font-semibold text-slate-600">{application.job.companyName}</p>
        <StatusBadge status={application.status} />
        <ApplicationProgressTrack application={application} />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900">Application timeline</h2>
          <ol className="mt-4 space-y-0">
            {application.timeline.map((item, index) => (
              <li key={`${item.status}-${index}`} className="relative pl-7">
                {index < application.timeline.length - 1 ? (
                  <span
                    className={`absolute left-[7px] top-5 h-[calc(100%-8px)] w-px ${
                      item.done ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                ) : null}
                <span
                  className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ${
                    item.done ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
                <p className={`font-bold ${item.done ? 'text-slate-900' : 'text-slate-400'}`}>
                  {item.status.replaceAll('_', ' ')}
                </p>
                {item.at ? (
                  <p className="mt-1 pb-5 text-sm text-slate-500">
                    {new Date(item.at).toLocaleDateString()}
                  </p>
                ) : (
                  <div className="pb-5" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <Link href="/jobs" className="inline-flex text-sm font-bold text-[#0a2e2c] hover:underline">
          Find more jobs
        </Link>
      </div>
    </CandidateAppShell>
  );
}
