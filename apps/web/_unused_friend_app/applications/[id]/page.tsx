'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ApplicationRecord } from '@careerbridge/shared';
import { getApplication } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { StatusBadge } from '@/components/AppNav';

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    getApplication(params.id).then(setApplication);
  }, [params.id]);

  if (!application) {
    return (
      <CandidateShell>
        <p className="text-muted">Loading application timeline...</p>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell>
      <Link href="/applications" className="text-sm font-bold text-teal hover:underline">
        ← Applications
      </Link>
      <h1 className="break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{application.job.title}</h1>
      <p className="mt-1 text-muted">{application.job.companyName}</p>
      <div className="mt-4">
        <StatusBadge status={application.status} />
      </div>
      <section className="cb-dash-card max-w-2xl p-4 sm:p-6">
        <h2 className="text-lg font-bold text-primary">Application timeline</h2>
        <ol className="mt-5 space-y-0">
          {application.timeline.map((item, index) => (
            <li key={item.status} className="relative pl-7">
              {index < application.timeline.length - 1 ? (
                <span className={`absolute left-[7px] top-5 h-[calc(100%-8px)] w-px ${item.done ? 'bg-success' : 'bg-primary/15'}`} />
              ) : null}
              <span className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ${item.done ? 'bg-success' : 'bg-primary/20'}`} />
              <p className={`font-bold ${item.done ? 'text-primary' : 'text-muted'}`}>
                {item.status.replaceAll('_', ' ')}
              </p>
              {item.at ? <p className="mt-1 pb-5 text-sm text-muted">{new Date(item.at).toLocaleDateString()}</p> : <div className="pb-5" />}
            </li>
          ))}
        </ol>
      </section>
      <Link href="/jobs" className="inline-flex font-bold text-teal hover:underline">
        Find more jobs
      </Link>
    </CandidateShell>
  );
}
