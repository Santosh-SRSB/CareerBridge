'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerDashboard, EmployerJobSummary } from '@careerbridge/shared';
import { getEmployerDashboard, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvAlert, EvEmpty, EvPageHead, EvSkeleton, EvStat } from '@/components/employer/ui';

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
        { label: 'Active jobs', value: dashboard.openJobs, hint: 'Live now' },
        { label: 'Applications', value: dashboard.applications, hint: 'Total received' },
        { label: 'Shortlisted', value: dashboard.shortlisted, hint: 'In pipeline' },
        { label: 'Interviews', value: dashboard.interviews, hint: 'Scheduled' },
      ]
    : [];

  const funnelRows = funnel
    ? [
        { label: 'Applications received', value: String(funnel.apps), width: funnel.apps > 0 ? 100 : 8 },
        { label: 'Shortlist rate', value: `${funnel.shortlistRate}%`, width: Math.max(funnel.shortlistRate, 8) },
        { label: 'Interview rate', value: `${funnel.interviewRate}%`, width: Math.max(funnel.interviewRate, 8) },
      ]
    : [];

  return (
    <EmployerShellFallback title="Reports">
      <EvPageHead
        eyebrow="Insights"
        title="Hiring Analytics"
        subtitle="Track job performance, applications, and shortlist funnel."
      />

      {error ? (
        <div className="ev-mt">
          <EvAlert tone="error">{error}</EvAlert>
        </div>
      ) : null}

      {loading ? (
        <div className="ev-grid ev-g4 ev-mt" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <EvSkeleton key={i} height={120} />
          ))}
        </div>
      ) : null}

      {dashboard && funnel ? (
        <>
          {isQuiet ? (
            <div className="ev-card ev-mt">
              <EvEmpty
                title="No hiring activity yet"
                body="Post a job to start collecting applications — analytics will fill in as candidates apply."
                action={
                  <Link href="/employer/jobs/new" className="ev-btn ev-mt-sm">
                    + Post a job
                  </Link>
                }
              />
            </div>
          ) : null}

          <div className="ev-grid ev-g4 ev-mt">
            {stats.map((item) => (
              <EvStat key={item.label} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>

          <div className="ev-grid ev-g2 ev-mt">
            <article className="ev-card">
              <small className="ev-eyebrow ev-eyebrow--teal">RECRUITMENT FUNNEL</small>
              <p className="ev-sub">From applications to interviews</p>
              <ul className="ev-plain-list ev-funnel">
                {funnelRows.map((row) => (
                  <li key={row.label}>
                    <div className="ev-row ev-row--flat">
                      <span>{row.label}</span>
                      <b>{row.value}</b>
                    </div>
                    <div className="ev-bar" aria-hidden>
                      <i style={{ width: `${row.width}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="ev-card">
              <small className="ev-eyebrow">TOP ROLES BY APPLICANTS</small>
              {topJobs.length === 0 ? (
                <EvEmpty
                  title="No jobs yet"
                  body="Create your first opening to see role rankings here."
                  action={
                    <Link href="/employer/jobs/new" className="ev-lnk">
                      Create a job →
                    </Link>
                  }
                />
              ) : (
                <ul className="ev-plain-list ev-linkrows">
                  {topJobs.map((job) => (
                    <li key={job.id}>
                      <Link href={`/employer/jobs/${job.id}`}>{job.title}</Link>
                      <span className="ev-pill">{job.applicantCount || 0}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </>
      ) : null}
    </EmployerShellFallback>
  );
}
