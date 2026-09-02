'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { Button } from '@/components/ui/Button';

function jobStatusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Active';
  if (status === 'CLOSED') return 'Closed';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'DRAFT') return 'Draft';
  return status.replaceAll('_', ' ');
}

function jobStatusTone(status: string) {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'CLOSED') return 'bg-slate-200 text-slate-700';
  if (status === 'PAUSED') return 'bg-amber-100 text-amber-900';
  return 'bg-primary-soft text-primary';
}

function postedLabel(job: EmployerJobSummary) {
  const raw = job.publishedAt || job.createdAt;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Posted recently';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const postedDay = new Date(date);
  postedDay.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - postedDay.getTime()) / 86400000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  return `Posted ${days} days ago`;
}

function JobRoleIcon({ status }: { status: string }) {
  if (status === 'PAUSED') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 8.5h8M8 12h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="9.2" y="14.2" width="2.2" height="3.6" rx="0.4" fill="currentColor" />
        <rect x="12.6" y="14.2" width="2.2" height="3.6" rx="0.4" fill="currentColor" />
      </svg>
    );
  }
  if (status === 'CLOSED') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 9h8M8 12.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M9.2 16.2l5.6-5.6M14.8 16.2L9.2 10.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (status === 'DRAFT') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
        <path
          d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M14 3.8V8h4.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12.2h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9.2h8M8 12.5h8M8 15.8h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17.2" cy="16.2" r="2.4" fill="currentColor" />
      <path d="M16.4 16.2h1.6M17.2 15.4v1.6" stroke="#0a2e2c" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function jobIconTone(status: string) {
  if (status === 'PUBLISHED') return 'cb-job-row__glyph cb-job-row__glyph--live';
  if (status === 'PAUSED') return 'cb-job-row__glyph cb-job-row__glyph--paused';
  if (status === 'CLOSED') return 'cb-job-row__glyph cb-job-row__glyph--closed';
  return 'cb-job-row__glyph';
}

export default function EmployerJobsPage() {
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setJobs(await listEmployerJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load jobs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = jobs.filter((job) => job.status === 'PUBLISHED').length;
    const drafts = jobs.filter((job) => job.status === 'DRAFT' || job.status === 'PAUSED').length;
    const applicants = jobs.reduce((sum, job) => sum + (job.applicantCount || 0), 0);
    return { active, drafts, applicants, total: jobs.length };
  }, [jobs]);

  return (
    <EmployerShellFallback>
      <section className="cb-employer-page cb-list-studio space-y-4">
        <header className="cb-list-studio__hero cb-list-studio__hero--jobs">
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold text-[#eab308]">Hiring pipeline</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Manage Jobs
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/75 sm:text-base">
              Track openings, publish drafts, and keep every role moving.
            </p>
            <Link
              href="/employer/jobs/new"
              className="cb-btn-shimmer mt-4 inline-flex rounded-full bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-5 py-2.5 text-sm font-bold text-navy shadow-[0_12px_28px_rgba(202,138,4,0.28)] transition duration-300 ease-out hover:brightness-110"
            >
              + Post New Job
            </Link>
          </div>
          <BrandMascot pose="checklist" motion="float" size="md" className="relative z-10 shrink-0" />
        </header>

        {!loading && jobs.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total roles', value: stats.total },
              { label: 'Active', value: stats.active },
              { label: 'Draft / paused', value: stats.drafts },
              { label: 'Applicants', value: stats.applicants },
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
              <BrandMascot pose="laptop" motion="pop" size="md" />
              <p className="font-semibold text-primary">No jobs yet</p>
              <p className="max-w-sm text-sm text-muted">
                Post your first opening to start matching candidates.
              </p>
              <Link href="/employer/jobs/new" className="mt-1 inline-block">
                <Button type="button" className="!rounded-full">
                  + Post New Job
                </Button>
              </Link>
            </div>
          ) : null}

          <div className="space-y-3">
            {jobs.map((job, index) => (
              <Link
                key={job.id}
                href={`/employer/jobs/${job.id}`}
                className="cb-job-row group block"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className={`${jobIconTone(job.status)} hidden sm:flex`} aria-hidden>
                    <JobRoleIcon status={job.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-primary group-hover:text-teal">
                          {job.title}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {job.applicantCount > 0
                            ? `${job.applicantCount} applicant${job.applicantCount === 1 ? '' : 's'} · ${postedLabel(job)}`
                            : `No application yet · ${postedLabel(job)}`}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary/55">
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
                            <path
                              d="M8 8.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                            />
                            <path
                              d="M3.2 7.4c1.3-3.2 2.9-4.8 4.8-4.8s3.5 1.6 4.8 4.8c-1.3 3.2-2.9 4.8-4.8 4.8S4.5 10.6 3.2 7.4Z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                            />
                          </svg>
                          {job.city}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(job.status)}`}
                      >
                        {jobStatusLabel(job.status)}
                      </span>
                    </div>
                    <div
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <JobStatusActions
                        jobId={job.id}
                        status={job.status}
                        compact
                        onUpdated={load}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </EmployerShellFallback>
  );
}
