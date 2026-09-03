'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';

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
    <EmployerShellFallback title="My Jobs">
      <div className="ep-desk">
        <EmployerPageHeader
          title="My Jobs"
          subtitle="Create, publish, pause, and close job postings."
          action={
            <Link href="/employer/jobs/new" className="ep-btn-gold">
              + Post New Job
            </Link>
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
                tone: 'ep-stat__icon--gold',
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
          {loading ? <p className="p-4 text-sm text-muted">Loading jobs…</p> : null}
          {error ? <p className="p-4 text-sm text-error">{error}</p> : null}

          {!loading && !error && !jobs.length ? (
            <div className="ep-empty px-5 py-10">
              <p>No jobs yet</p>
              <p className="ep-empty__sub">Create your first job posting.</p>
              <Link href="/employer/jobs/new" className="ep-btn-gold mt-3 inline-flex rounded-xl px-4 py-2 text-sm font-extrabold">
                + Create Job
              </Link>
            </div>
          ) : null}

          {!loading && jobs.length > 0 ? (
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
                  {jobs.map((job) => (
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
                      <td className="font-semibold">{job.applicantCount || 0}</td>
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
