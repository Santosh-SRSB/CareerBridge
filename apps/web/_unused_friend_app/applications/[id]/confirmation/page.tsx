'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ApplicationRecord } from '@careerbridge/shared';
import { getApplication } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';

export default function ApplicationConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    getApplication(params.id).then(setApplication);
  }, [params.id]);

  if (!application) {
    return (
      <CandidateShell>
        <p className="text-muted">Confirming your application...</p>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell>
      <div className="cb-dash-card mx-auto max-w-xl p-6 text-center sm:p-8">
        <p className="text-4xl text-success">✓</p>
        <h1 className="mt-4 text-2xl font-extrabold text-primary sm:text-3xl">Application submitted</h1>
        <p className="mt-3 text-muted">Your application has been sent to {application.job.companyName}.</p>
        <p className="mt-4 break-words text-lg font-bold text-primary">{application.job.title}</p>
        <p className="mt-2 text-sm text-muted">Applied → Under Review</p>
        <Link
          href={`/applications/${application.id}`}
          className="mt-6 inline-flex h-8 items-center rounded-full bg-[#1ec8c0] px-3.5 text-xs font-extrabold text-[#0c3340]"
        >
          Track Application
        </Link>
        <div className="mt-4">
          <Link href="/jobs" className="font-bold text-teal hover:underline">
            Find more jobs
          </Link>
        </div>
      </div>
    </CandidateShell>
  );
}
