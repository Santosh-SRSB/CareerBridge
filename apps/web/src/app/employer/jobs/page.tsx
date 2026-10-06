'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerSectionHero, EmployerQuickLink } from '@/components/employer/EmployerSectionHero';
import { EmployerEmptyCue } from '@/components/employer/EmployerEmptyCue';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';
import { JOB_STATUS_FILTERS, jobStatusLabel, jobStatusTone, type JobStatusFilter } from '@/lib/job-status';

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
  const [filter, setFilter] = useState<JobStatusFilter>('ALL');

  async function load() {
    setError('');
    setLoading(true);
    try {
      setJobs(await listEmployerJobs());
    } catch {
      setError(LOAD_ERROR_MESSAGE);
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

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: jobs.length };
    for (const job of jobs) out[job.status] = (out[job.status] || 0) + 1;
    return out;
  }, [jobs]);

  const visibleJobs = useMemo(
    () => (filter === 'ALL' ? jobs : jobs.filter((job) => job.status === filter)),
    [jobs, filter],
  );

  return (
    <EmployerShellFallback title="My Jobs">
      <div className="ep-desk ep-page ep-page--jobs">
        <EmployerSectionHero
          tone="jobs"
          title="My Jobs"
          subtitle="Create, publish, pause, and close openings from one board."
          action={
            <EmployerQuickLink href="/employer/jobs/new">Post new job</EmployerQuickLink>
          }
        />

        {!loading && jobs.length ? (
          <div className="ep-stats">
            {[
              {
                label: 'Total roles',
                value: stats.total,
                tone: '',
                hint: 'All openings',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                label: 'Active',
                value: stats.active,
                tone: 'ep-stat__icon--teal',
                hint: 'Live now',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9.2 12.2l1.9 1.9 3.7-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                label: 'Draft / paused',
                value: stats.drafts,
                tone: 'ep-stat__icon--soft',
                hint: 'Needs action',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="9" y="6" width="2.4" height="12" rx="0.6" fill="currentColor" />
                    <rect x="12.6" y="6" width="2.4" height="12" rx="0.6" fill="currentColor" />
                  </svg>
                ),
              },
              {
                label: 'Applicants',
                value: stats.applicants,
                tone: 'ep-stat__icon--soft',
                hint: 'Across roles',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="16" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.5 18c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.label} className="ep-card ep-stat">
                <div className={`ep-stat__icon ${item.tone}`}>{item.icon}</div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <em>{item.hint}</em>
              </div>
            ))}
          </div>
        ) : null}

        <article className="ep-card ep-list-card">
          {loading ? <SkeletonList rows={3} label="Loading jobs…" className="p-4" /> : null}
          {error && !loading ? <ErrorState message={error} onRetry={() => void load()} className="m-4" /> : null}

          {!loading && !error && !jobs.length ? (
            <div className="ep-polished-empty">
              <EmployerEmptyCue cue="jobs" />
              <div>
                <p className="ep-polished-empty__title">No jobs yet</p>
                <p className="ep-polished-empty__copy">Create your first job posting to start hiring.</p>
                <Link href="/employer/jobs/new" className="ep-hero__link ep-polished-empty__cta">
                  + Create Job
                </Link>
              </div>
            </div>
          ) : null}

          {!loading && !error && jobs.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-4 pb-0" role="group" aria-label="Filter jobs by status">
              {JOB_STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-12 rounded-full border px-4 text-sm font-bold ${
                    filter === item.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-primary'
                  }`}
                >
                  {item.label} ({counts[item.value] || 0})
                </button>
              ))}
            </div>
          ) : null}

          {!loading && !error && jobs.length > 0 && !visibleJobs.length ? (
            <p className="p-6 text-sm font-semibold text-slate-700" role="status">
              No {JOB_STATUS_FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} jobs.
            </p>
          ) : null}

          {!loading && visibleJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="ep-wire-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Applications</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <p className="font-extrabold text-primary">{job.title}</p>
                        <p className="text-xs text-muted">{job.city || '—'} · {postedLabel(job)}</p>
                      </td>
                      <td>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(job.status)}`}>
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="font-semibold">
                        <Link
                          href={`/employer/applications?jobId=${encodeURIComponent(job.id)}`}
                          className="text-primary underline underline-offset-2 hover:no-underline"
                          aria-label={`${job.applicantCount || 0} applications for ${job.title}`}
                        >
                          {job.applicantCount || 0} {(job.applicantCount || 0) === 1 ? 'Application' : 'Applications'}
                        </Link>
                      </td>
                      <td>
                        <div className="ep-wire-actions">
                          <Link href={`/employer/jobs/${job.id}`}>View</Link>
                          <Link href={`/employer/jobs/new?edit=${encodeURIComponent(job.id)}`}>Edit</Link>
                          <JobStatusActions jobId={job.id} status={job.status} compact onUpdated={load} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </div>
    </EmployerShellFallback>
  );
}
