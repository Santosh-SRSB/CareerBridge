'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';

function applicantLabel(count: number) {
  if (count <= 0) return 'No application yet';
  if (count === 1) return '1 applicant';
  return `${count} applicants`;
}

export default function EmployerApplicationsIndex() {
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listEmployerJobs()
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load applications.'))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const applicants = jobs.reduce((sum, job) => sum + (job.applicantCount || 0), 0);
    const waiting = jobs.filter((job) => (job.applicantCount || 0) === 0).length;
    const withApps = jobs.filter((job) => (job.applicantCount || 0) > 0).length;
    return { applicants, waiting, withApps, roles: jobs.length };
  }, [jobs]);

  return (
    <EmployerShellFallback>
      <section className="cb-employer-page cb-list-studio space-y-4">
        <header className="cb-list-studio__hero cb-list-studio__hero--apps">
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold text-[#eab308]">Candidate inbox</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Applications
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/75 sm:text-base">
              See how many people applied to each opening — and jump in to review.
            </p>
          </div>
          <BrandMascot pose="tablet" motion="float" size="md" priority className="relative z-10 shrink-0" />
        </header>

        {!loading && jobs.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Openings', value: totals.roles },
              { label: 'With applicants', value: totals.withApps },
              { label: 'Waiting', value: totals.waiting },
              { label: 'Total applicants', value: totals.applicants },
            ].map((item) => (
              <div key={item.label} className="cb-lift-card rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                <p className="cb-metric-value mt-1 text-2xl font-extrabold text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="cb-list-studio__panel">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="cb-shimmer h-24 rounded-2xl bg-fog/80" />
              ))}
            </div>
          ) : null}
          {error ? <p className="text-sm text-error">{error}</p> : null}

          {!loading && !error && !jobs.length ? (
            <div className="cb-mascot-empty rounded-2xl border border-dashed border-primary/15 bg-gradient-to-b from-fog/80 to-white px-4 py-10">
              <BrandMascot pose="book" motion="pop" size="md" />
              <p className="font-semibold text-primary">No application yet</p>
              <p className="max-w-sm text-sm text-muted">Post a job to start receiving applicants.</p>
              <Link
                href="/employer/jobs/new"
                className="mt-1 inline-block text-sm font-semibold text-teal hover:underline"
              >
                Post a job →
              </Link>
            </div>
          ) : null}

          <div className="space-y-3">
            {jobs.map((job, index) => {
              const count = job.applicantCount || 0;
              const heat = Math.min(100, count * 18);
              return (
                <Link
                  key={job.id}
                  href={`/employer/jobs/${job.id}`}
                  className="cb-job-row group block"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="cb-job-row__mark" aria-hidden>
                      {count > 0 ? count : '–'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="truncate text-base font-bold text-primary group-hover:text-teal">
                          {job.title}
                        </p>
                        {count > 0 ? (
                          <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-accent">
                            Review
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-fog px-3 py-1 text-xs font-bold text-muted">
                            Waiting
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {applicantLabel(count)}
                        {job.city ? ` · ${job.city}` : ''}
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal to-[#0f766e] transition-all duration-500 ease-out"
                          style={{ width: `${heat}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </EmployerShellFallback>
  );
}
