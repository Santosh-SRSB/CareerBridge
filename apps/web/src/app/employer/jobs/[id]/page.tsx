'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { changeApplicationStatus, getEmployerJob, listEmployerApplications } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { StatusBadge } from '@/components/AppNav';

const ACTIONS = [
  { value: 'REVIEW', label: 'Review' },
  { value: 'SHORTLIST', label: 'Shortlist' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'SELECT', label: 'Select' },
  { value: 'REJECT', label: 'Not selected' },
];

export default function EmployerJobApplicationsPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<EmployerApplication[]>([]);
  const [title, setTitle] = useState('this job');
  const [status, setStatus] = useState('PUBLISHED');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [nextItems, job] = await Promise.all([
      listEmployerApplications(params.id),
      getEmployerJob(params.id).catch(() => null),
    ]);
    setItems(nextItems);
    if (job && typeof job.title === 'string') setTitle(job.title);
    if (job && typeof job.status === 'string') setStatus(job.status);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [params.id]);

  const countLabel =
    items.length === 0 ? 'No application yet' : `${items.length} applicant${items.length === 1 ? '' : 's'}`;

  return (
    <EmployerShellFallback>
      <section className="cb-dash-card overflow-hidden p-5 sm:p-6">
        <Link href="/employer/applications" className="text-sm font-semibold text-teal hover:underline">
          ← Applications
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Applicants</h1>
            <p className="mt-1 text-sm text-muted">
              {title}
              {loading ? '' : ` · ${countLabel}`}
            </p>
          </div>
          {!loading ? <StatusBadge status={status} /> : null}
        </div>
        {!loading ? <JobStatusActions jobId={params.id} status={status} onUpdated={load} /> : null}
        {loading ? <p className="mt-6 text-sm text-muted">Loading applicants...</p> : null}
        {!loading && items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-primary/20 bg-fog/60 px-5 py-10 text-center">
            <p className="font-semibold text-primary">No application yet</p>
            <p className="mt-2 text-sm text-muted">Matching candidates will show up here when they apply.</p>
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <section key={item.id} className="rounded-md bg-surface p-5 shadow-sm">
              <p className="font-semibold text-primary">
                {[item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate'}
              </p>
              <p className="text-sm text-muted">
                {item.candidate.city} · {item.candidate.skills.join(', ')}
              </p>
              {item.match ? <p className="mt-2 text-sm text-accent">Match {item.match.score}%</p> : null}
              <div className="mt-2">
                <StatusBadge status={item.status} />
              </div>
              {item.screeningAnswers?.length ? (
                <div className="mt-3 space-y-2 rounded-md bg-fog px-3 py-2 text-sm">
                  <p className="font-semibold text-primary">Screening answers</p>
                  {item.screeningAnswers.map((answer) => (
                    <div key={answer.questionId}>
                      <p className="text-xs font-semibold text-muted">{answer.prompt || 'Question'}</p>
                      <p className="text-primary">{answer.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    className="rounded-sm border border-primary/20 px-3 py-2 text-sm font-semibold text-primary"
                    onClick={async () => {
                      await changeApplicationStatus(item.id, action.value);
                      await load();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </EmployerShellFallback>
  );
}
