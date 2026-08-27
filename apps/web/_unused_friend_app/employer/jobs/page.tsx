'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listEmployerJobs, publishEmployerJob } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import { StatusBadge } from '@/components/AppNav';

export default function EmployerJobsPage() {
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; city: string; status: string }>>([]);

  async function load() {
    setJobs(await listEmployerJobs());
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Jobs</h1>
      <Link href="/employer/jobs/new" className="mt-4 inline-flex rounded-sm bg-primary px-4 py-3 font-semibold text-accent">Create Job</Link>
      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-md bg-surface p-4 shadow-sm">
            <p className="font-semibold text-primary">{job.title}</p>
            <p className="text-sm text-muted">{job.city}</p>
            <div className="mt-2"><StatusBadge status={job.status} /></div>
            <div className="mt-3 flex gap-3">
              <Link href={`/employer/jobs/${job.id}`} className="font-semibold text-accent">Applications</Link>
              {job.status !== 'PUBLISHED' ? (
                <button type="button" className="font-semibold text-primary" onClick={async () => { await publishEmployerJob(job.id); await load(); }}>Publish</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <EmployerNav />
    </main>
  );
}
