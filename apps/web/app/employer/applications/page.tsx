'use client';

import { useEffect, useState } from 'react';
import { listEmployerJobs } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import Link from 'next/link';

export default function EmployerApplicationsIndex() {
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    listEmployerJobs().then(setJobs);
  }, []);
  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Applications</h1>
      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
          <Link key={job.id} href={`/employer/jobs/${job.id}`} className="block rounded-md bg-surface p-4 shadow-sm">
            {job.title}
          </Link>
        ))}
      </div>
      <EmployerNav />
    </main>
  );
}
