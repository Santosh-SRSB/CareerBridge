'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ApplicationRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { fetchApplication } from '@/lib/candidate-marketplace-api';

export default function ApplicationConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    fetchApplication(params.id).then(setApplication);
  }, [params.id]);

  if (!application) {
    return (
      <CandidateAppShell activeTab="applications">
        <p className="text-slate-500">Confirming your application...</p>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="applications" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-5xl text-emerald-600">✓</p>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Application Submitted</h1>
        <p className="mt-4 text-lg font-bold text-slate-800">{application.job.title}</p>
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
