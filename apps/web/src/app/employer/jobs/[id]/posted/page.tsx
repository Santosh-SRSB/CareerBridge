'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getEmployerJob } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { Button } from '@/components/ui/Button';

function JobPostedBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  useEffect(() => {
    const fromQuery = searchParams.get('title')?.trim() || '';
    if (fromQuery) setTitle(fromQuery);
    getEmployerJob(params.id)
      .then((job) => {
        if (typeof job.title === 'string' && job.title.trim()) {
          setTitle(job.title.trim());
        }
        if (typeof job.status === 'string') {
          setStatus(job.status);
        }
      })
      .catch(() => undefined);
  }, [params.id, searchParams]);

  return (
    <EmployerShellFallback>
      <section className="cb-dash-card mx-auto max-w-lg overflow-hidden px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="mx-auto flex justify-center">
          <BrandMascot pose="checklist" motion="pop" size="lg" priority />
        </div>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
          Job Posted Successfully!
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted sm:text-base">
          Your{' '}
          <span className="font-semibold text-primary">{title || 'job'}</span> opening is now live and available
          to matching candidates.
        </p>

        <div className="mx-auto mt-6 max-w-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Position controls</p>
          <JobStatusActions
            jobId={params.id}
            status={status}
            onUpdated={async () => {
              const job = await getEmployerJob(params.id);
              if (typeof job.status === 'string') setStatus(job.status);
            }}
          />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link href={`/employer/jobs/${params.id}`}>
            <Button type="button">View Job</Button>
          </Link>
          <Link href="/employer/jobs/new">
            <Button type="button" variant="secondary">
              Post Another Job
            </Button>
          </Link>
          <Link href="/employer/jobs" className="pt-1 text-sm font-semibold text-teal hover:underline">
            Go to Manage Jobs
          </Link>
        </div>
      </section>
    </EmployerShellFallback>
  );
}

export default function JobPostedPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-muted">Loading confirmation...</main>
      }
    >
      <JobPostedBody />
    </Suspense>
  );
}
