'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { EmployerJobSummary } from '@careerbridge/shared';
import { getEmployerDashboard, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvEmpty, EvJobStatus, EvPlainHead, EvSkeleton } from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';

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

export default function EmployerHistoryPage() {
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [views, setViews] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const closedJobs = useMemo(() => jobs.filter((job) => job.status === 'CLOSED'), [jobs]);

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = closedJobs.filter((job) => !q || job.title.toLowerCase().includes(q));
    if (sort === 'apps') return [...list].sort((a, b) => (b.applicantCount || 0) - (a.applicantCount || 0));
    return [...list].sort((a, b) => (sort === 'new' ? postedTime(b) - postedTime(a) : postedTime(a) - postedTime(b)));
  }, [closedJobs, query, sort]);

  return (
    <EmployerShellFallback title="History">
      <EvPlainHead
        title="History"
        subtitle="Closed roles stay here for reference. Open hiring lives under Jobs."
        actions={
          <Link href="/employer/jobs" className="ev-btn ev-btn--ghost">
            Back to Jobs
          </Link>
        }
      />

      {loading ? (
        <div className="ev-grid">
          <EvSkeleton height={90} />
          <EvSkeleton height={90} />
        </div>
      ) : null}
      {error && !loading ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && !closedJobs.length ? (
        <div className="ev-card">
          <EvEmpty
            title="No closed jobs yet"
            body="When you close a role from Jobs, it will appear here."
            action={
              <Link href="/employer/jobs" className="ev-btn ev-btn--accent">
                Go to Jobs
              </Link>
            }
          />
        </div>
      ) : null}

      {!loading && !error && closedJobs.length > 0 ? (
        <>
          <div className="ev-jbar">
            <p className="ev-sub" style={{ flex: '1 1 200px', margin: 0 }}>
              {closedJobs.length} closed role{closedJobs.length === 1 ? '' : 's'}
            </p>
            <select aria-label="Sort closed jobs" value={sort} onChange={(e) => setSort(e.target.value as JobSort)}>
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
                placeholder="Search closed jobs (press /)"
                aria-label="Search closed jobs"
              />
            </label>
          </div>

          {!visibleJobs.length ? (
            <div className="ev-card" role="status">
              <EvEmpty title="No jobs found" body="Try clearing the search." />
            </div>
          ) : (
            visibleJobs.map((job) => {
              const applicants = job.applicantCount || 0;
              const jobViews = views.get(job.id);
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
                    <b>{applicants}</b> application{applicants === 1 ? '' : 's'}
                    {applicants > 0 ? (
                      <Link
                        href={`/employer/applications?jobId=${encodeURIComponent(job.id)}`}
                        aria-label={`View applicants for ${job.title}`}
                      >
                        View applicants
                      </Link>
                    ) : (
                      <small>{jobViews ? `${jobViews} views · No applications` : 'No applications'}</small>
                    )}
                  </div>
                  <div className="ev-jx">
                    <Link href={`/employer/jobs/${job.id}`}>View</Link>
                    <Link href={`/employer/jobs/new?edit=${encodeURIComponent(job.id)}`}>Edit</Link>
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
