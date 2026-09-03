'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerDashboard, EmployerJobSummary } from '@careerbridge/shared';
import { getEmployerDashboard, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';

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

  return (
    <EmployerShellFallback title="Reports">
      <div className="ep-desk">
        <EmployerPageHeader
          title="Hiring Reports"
          subtitle="Track job performance, applications, and shortlist funnel."
        />

        {loading ? <p className="text-sm text-muted">Loading reports…</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {dashboard && funnel ? (
          <>
            <div className="ep-stats">
              {[
                { label: 'Active Jobs', value: dashboard.openJobs, tone: 'ep-stat__icon--teal', hint: 'Live now' },
                { label: 'Applications', value: dashboard.applications, tone: '', hint: 'Total received' },
                { label: 'Shortlisted', value: dashboard.shortlisted, tone: 'ep-stat__icon--gold', hint: 'In pipeline' },
                { label: 'Interviews', value: dashboard.interviews, tone: 'ep-stat__icon--soft', hint: 'Scheduled' },
              ].map((item) => (
                <div key={item.label} className="ep-card ep-stat">
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                  <em>{item.hint}</em>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="ep-card p-6">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">Recruitment funnel</h2>
                <ul className="mt-5 space-y-4 text-sm">
                  <li className="flex items-center justify-between gap-3 border-b border-primary/5 pb-3">
                    <span className="text-muted">Applications received</span>
                    <strong className="text-lg text-primary">{funnel.apps}</strong>
                  </li>
                  <li className="flex items-center justify-between gap-3 border-b border-primary/5 pb-3">
                    <span className="text-muted">Shortlist rate</span>
                    <strong className="text-lg text-primary">{funnel.shortlistRate}%</strong>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted">Interview rate</span>
                    <strong className="text-lg text-primary">{funnel.interviewRate}%</strong>
                  </li>
                </ul>
              </article>

              <article className="ep-card p-6">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">Top jobs by applicants</h2>
                {topJobs.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">No jobs posted yet.</p>
                ) : (
                  <ul className="mt-5 space-y-3 text-sm">
                    {topJobs.map((job, index) => (
                      <li key={job.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f8faf9] px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                            {index + 1}
                          </span>
                          <Link href={`/employer/jobs/${job.id}`} className="truncate font-semibold text-primary hover:text-teal">
                            {job.title}
                          </Link>
                        </div>
                        <span className="shrink-0 font-bold text-teal">{job.applicantCount || 0}</span>
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
