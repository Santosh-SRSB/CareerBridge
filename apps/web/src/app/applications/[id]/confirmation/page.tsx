'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ApplicationRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { fetchApplication } from '@/lib/candidate-marketplace-api';

export default function ApplicationConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchApplication(params.id)
      .then(setApplication)
      .catch(() => setFailed(true));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) {
    return (
      <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
        <ErrorState onRetry={load} />
      </CandidateAppShell>
    );
  }

  if (!application) {
    return (
      <CandidateAppShell activeTab="applications">
        <SkeletonList rows={1} label="Confirming your application…" />
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-5xl text-emerald-700" aria-hidden>
          ✓
        </p>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Application Submitted ✓</h1>
        <p className="mt-4 text-lg font-bold text-slate-800">{application.job.title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-700" data-testid="confirmation-company">
          {application.job.companyName}
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Your application has been sent successfully.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/applications/${application.id}`}>
            <Button type="button" className="w-full sm:w-auto">
              Track Application
            </Button>
          </Link>
          <Link href="/jobs">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Find More Jobs
            </Button>
          </Link>
        </div>
      </div>
    </CandidateAppShell>
  );
}
