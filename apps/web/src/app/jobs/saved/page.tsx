'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobCard } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { listSavedJobs, unsaveJob } from '@/lib/api';
import { formatJobType, formatSalary } from '@/lib/match';

export default function SavedJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    listSavedJobs()
      .then((result) => setJobs(result.items || []))
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await unsaveJob(id);
      setJobs((prev) => prev.filter((job) => job.id !== id));
    } finally {
      setBusyId('');
    }
  }

  return (
    <CandidateAppShell activeTab="jobs" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Saved Jobs</h1>
            <p className="mt-1 text-sm text-slate-600">Roles you bookmarked to apply later.</p>
          </div>
          <Link href="/jobs" className="text-sm font-bold text-[#0a2e2c] hover:underline">
            Find jobs
          </Link>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading saved jobs…</p> : null}

        {!loading && jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">No saved jobs yet.</p>
            <Button type="button" className="mt-4" onClick={() => router.push('/jobs')}>
              Browse jobs
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/jobs/${job.id}`} className="text-base font-extrabold text-slate-900 hover:underline">
                    {job.title}
                  </Link>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{job.companyName}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {job.city} · {formatSalary(job.salaryMin, job.salaryMax)} · {formatJobType(job.jobType)}
                  </p>
                </div>
                {job.match ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    {job.match.score}%
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => router.push(`/jobs/${job.id}`)}>
                  View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId === job.id}
                  onClick={() => void remove(job.id)}
                >
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </CandidateAppShell>
  );
}
