'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { getEmployerDashboard, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { EvEmpty, EvJobStatus, EvPlainHead, EvSkeleton } from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';
import { JOB_STATUS_FILTERS, type JobStatusFilter } from '@/lib/job-status';

type JobSort = 'new' | 'old' | 'apps';

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

function postedTime(job: EmployerJobSummary) {
  const time = new Date(job.publishedAt || job.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function EmployerJobsPage() {
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [views, setViews] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<JobStatusFilter>('ALL');
  const [sort, setSort] = useState<JobSort>('new');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

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
    getEmployerDashboard()
      .then((dash) => setViews(new Map((dash.jobPerformance || []).map((row) => [row.jobId, row.views]))))
      .catch(() => undefined);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const stats = useMemo(() => {
    const active = jobs.filter((job) => job.status === 'PUBLISHED').length;
    const drafts = jobs.filter((job) => job.status === 'DRAFT' || job.status === 'PAUSED').length;
    const applicants = jobs.reduce((sum, job) => sum + (job.applicantCount || 0), 0);
    let totalViews = 0;
    views.forEach((value) => {
      totalViews += value;
    });
    return { active, drafts, applicants, total: jobs.length, views: totalViews };
  }, [jobs, views]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: jobs.length };
    for (const job of jobs) out[job.status] = (out[job.status] || 0) + 1;
    return out;
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = jobs.filter(
      (job) => (filter === 'ALL' || job.status === filter) && (!q || job.title.toLowerCase().includes(q)),
    );
    if (sort === 'apps') return [...list].sort((a, b) => (b.applicantCount || 0) - (a.applicantCount || 0));
    return [...list].sort((a, b) => (sort === 'new' ? postedTime(b) - postedTime(a) : postedTime(a) - postedTime(b)));
  }, [jobs, filter, query, sort]);

  return (
    <EmployerShellFallback title="My Jobs">
      <EvPlainHead
        title="My jobs"
        subtitle="Create, publish, pause and close openings from one board."
        actions={
          <Link href="/employer/jobs/new" className="ev-btn ev-btn--accent">
            + Post new job
          </Link>
        }
      />

      {loading ? (
        <div className="ev-grid">
          <EvSkeleton height={130} />
          <EvSkeleton height={110} />
          <EvSkeleton height={110} />
        </div>
      ) : null}
      {error && !loading ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && !jobs.length ? (
        <div className="ev-card">
          <EvEmpty
            title="No jobs yet"
            body="Create your first job posting to start hiring."
            action={
              <Link href="/employer/jobs/new" className="ev-btn ev-btn--accent">
                + Create Job
              </Link>
            }
          />
        </div>
      ) : null}

      {!loading && !error && jobs.length > 0 ? (
        <>
          <div className="ev-jstats">
            {[
              { label: 'Total roles', value: stats.total, hint: 'All openings' },
              { label: 'Active', value: stats.active, hint: 'Live now' },
              { label: 'Draft or paused', value: stats.drafts, hint: 'Need action' },
              {
                label: 'Applicants',
                value: stats.applicants,
                hint: views.size ? `${stats.views} views across roles` : 'Across roles',
              },
            ].map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}</b>
                <small>{item.hint}</small>
              </div>
            ))}
          </div>

          <div className="ev-jbar">
            <div className="ev-jtabs" role="group" aria-label="Filter jobs by status">
              {JOB_STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ev-jtab${filter === item.value ? ' on' : ''}`}
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                  <em>{counts[item.value] || 0}</em>
                </button>
              ))}
            </div>
            <select aria-label="Sort jobs" value={sort} onChange={(e) => setSort(e.target.value as JobSort)}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="apps">Most applicants</option>
            </select>
            <label className="ev-jsearch">
              <span aria-hidden>&#9906;</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search jobs (press /)"
                aria-label="Search jobs"
              />
            </label>
          </div>

          {!visibleJobs.length ? (
            <div className="ev-card" role="status">
              <EvEmpty title="No jobs found" body="Try another status or clear the search." />
            </div>
          ) : (
            visibleJobs.map((job) => {
              const applicants = job.applicantCount || 0;
              const jobViews = views.get(job.id);
              const conversion = jobViews ? (applicants / jobViews) * 100 : null;
              return (
                <article key={job.id} className="ev-jcard">
                  <div className="ev-jt">
                    <b>{job.title}</b>
                    <span>
                      {job.city || '—'} · {postedLabel(job)}
                    </span>
                  </div>
                  <EvJobStatus status={job.status} />
                  <div className="ev-ja">
                    {applicants > 0 ? (
                      <>
                        <b>{applicants}</b> application{applicants === 1 ? '' : 's'}
                        <Link
                          href={`/employer/applications?jobId=${encodeURIComponent(job.id)}`}
                          aria-label={`Review ${applicants} applicant${applicants === 1 ? '' : 's'} for ${job.title}`}
                        >
                          Review applicants
                        </Link>
                        {conversion != null ? (
                          <>
                            <div className="ev-pb" aria-hidden>
                              <i style={{ width: `${Math.min(100, Math.max(10, conversion * 16))}%` }} />
                            </div>
                            <small>
                              {jobViews} views · {conversion.toFixed(1)}% conversion
                            </small>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <b>0</b> applications
                        <small>
                          {job.status === 'DRAFT' ? 'Publish to start receiving applicants' : 'No applications yet'}
                        </small>
                      </>
                    )}
                  </div>
                  <div className="ev-jx">
                    <Link href={`/employer/jobs/${job.id}`}>View</Link>
                    <Link href={`/employer/jobs/new?edit=${encodeURIComponent(job.id)}`}>Edit</Link>
                    <JobStatusActions jobId={job.id} status={job.status} compact onUpdated={load} />
                  </div>
                </article>
              );
            })
          )}
        </>
      ) : null}
    </EmployerShellFallback>
  );
}
