'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerDashboard, EmployerJobSummary } from '@careerbridge/shared';
import { getEmployerDashboard, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerSectionHero } from '@/components/employer/EmployerSectionHero';
import { EmployerEmptyCue } from '@/components/employer/EmployerEmptyCue';

export default function EmployerReportsPage() {
  const [dashboard, setDashboard] = useState<EmployerDashboard | null>(null);
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getEmployerDashboard(), listEmployerJobs()])
      .then(([dash, jobRows]) => {
        setDashboard(dash);
        setJobs(jobRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load reports.'))
      .finally(() => setLoading(false));
  }, []);

  const funnel = useMemo(() => {
    if (!dashboard) return null;
    const apps = dashboard.applications || 0;
    const shortlistRate = apps > 0 ? Math.round((dashboard.shortlisted / apps) * 100) : 0;
    const interviewRate = apps > 0 ? Math.round((dashboard.interviews / apps) * 100) : 0;
    return { apps, shortlistRate, interviewRate };
  }, [dashboard]);

  const topJobs = useMemo(() => {
    return [...jobs]
      .sort((a, b) => (b.applicantCount || 0) - (a.applicantCount || 0))
      .slice(0, 5);
  }, [jobs]);

  const isQuiet =
    dashboard &&
    dashboard.openJobs === 0 &&
    dashboard.applications === 0 &&
    dashboard.shortlisted === 0 &&
    dashboard.interviews === 0;

  const stats = dashboard
    ? [
        { label: 'Active Jobs', value: dashboard.openJobs, hint: 'Live now', tone: 'a' as const },
        { label: 'Applications', value: dashboard.applications, hint: 'Total received', tone: 'b' as const },
        { label: 'Shortlisted', value: dashboard.shortlisted, hint: 'In pipeline', tone: 'c' as const },
        { label: 'Interviews', value: dashboard.interviews, hint: 'Scheduled', tone: 'd' as const },
      ]
    : [];

  return (
    <EmployerShellFallback title="Reports">
      <div className="ep-desk ep-page ep-page--analytics">
        <EmployerSectionHero
          tone="analytics"
          compact
          title="Hiring Analytics"
          subtitle="Track job performance, applications, and shortlist funnel."
        />

        {loading ? <p className="text-sm text-muted">Loading reports…</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {dashboard && funnel ? (
          <>
            {isQuiet ? (
              <div className="ep-polished-empty ep-an-empty">
                <EmployerEmptyCue cue="chart" />
                <div>
                  <p className="ep-polished-empty__title">No hiring activity yet</p>
                  <p className="ep-polished-empty__copy">
                    Post a job to start collecting applications — analytics will fill in as candidates apply.
                  </p>
                  <Link href="/employer/jobs/new" className="ep-hero__link ep-polished-empty__cta">
                    + Post a job
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="ep-an-stats">
              {stats.map((item, i) => (
                <div
                  key={item.label}
                  className={`ep-an-stat ep-an-stat--${item.tone}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className="ep-an-stat__dot" aria-hidden />
                  <p className="ep-an-stat__label">{item.label}</p>
                  <strong className="ep-an-stat__value">{item.value}</strong>
                  <em className="ep-an-stat__hint">{item.hint}</em>
                </div>
              ))}
            </div>

            <div className="ep-an-grid">
              <article className="ep-an-funnel">
                <div className="ep-an-funnel__head">
                  <h2 className="ep-an-funnel__title">Recruitment funnel</h2>
                  <p className="ep-an-funnel__sub">From applications to interviews</p>
                </div>
                <ul className="ep-an-funnel__list">
                  <li>
                    <div className="ep-an-funnel__row">
                      <span>Applications received</span>
                      <strong>{funnel.apps}</strong>
                    </div>
                    <div className="ep-an-funnel__track" aria-hidden>
                      <span
                        className="ep-an-funnel__fill ep-an-funnel__fill--a"
                        style={{ width: funnel.apps > 0 ? '100%' : '8%' }}
                      />
                    </div>
                  </li>
                  <li>
                    <div className="ep-an-funnel__row">
                      <span>Shortlist rate</span>
                      <strong>{funnel.shortlistRate}%</strong>
                    </div>
                    <div className="ep-an-funnel__track" aria-hidden>
                      <span
                        className="ep-an-funnel__fill ep-an-funnel__fill--b"
                        style={{ width: `${Math.max(funnel.shortlistRate, 8)}%` }}
                      />
                    </div>
                  </li>
                  <li>
                    <div className="ep-an-funnel__row">
                      <span>Interview rate</span>
                      <strong>{funnel.interviewRate}%</strong>
                    </div>
                    <div className="ep-an-funnel__track" aria-hidden>
                      <span
                        className="ep-an-funnel__fill ep-an-funnel__fill--c"
                        style={{ width: `${Math.max(funnel.interviewRate, 8)}%` }}
                      />
                    </div>
                  </li>
                </ul>
              </article>

              <article className="ep-an-panel">
                <h2 className="ep-an-panel__title">Top roles by applicants</h2>
                {topJobs.length === 0 ? (
                  <div className="ep-polished-empty ep-polished-empty--inset">
                    <EmployerEmptyCue cue="jobs" />
                    <div>
                      <p className="ep-polished-empty__title">No jobs yet</p>
                      <p className="ep-polished-empty__copy">Create your first opening to see role rankings here.</p>
                      <Link href="/employer/jobs/new" className="ep-link font-extrabold">
                        Create a job →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <ul className="ep-an-panel__list">
                    {topJobs.map((job, i) => (
                      <li key={job.id} style={{ animationDelay: `${i * 60}ms` }}>
                        <Link href={`/employer/jobs/${job.id}`}>{job.title}</Link>
                        <span>{job.applicantCount || 0}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
