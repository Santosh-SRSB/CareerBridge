'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  getEmployerJob,
  listEmployerApplications,
  listJobMatches,
  recomputeJobMatches,
  recordHiringOutcome,
  type JobMatchRow,
} from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { StatusBadge } from '@/components/AppNav';
import { Button } from '@/components/ui/Button';

const ACTIONS = [
  { value: 'REVIEW', label: 'Review' },
  { value: 'SHORTLIST', label: 'Shortlist' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'SELECT', label: 'Select' },
  { value: 'HIRE', label: 'Hire' },
  { value: 'REJECT', label: 'Not selected' },
] as const;

const OUTCOMES = [
  { value: 'HIRED', label: 'Confirm hired' },
  { value: 'OFFER_EXTENDED', label: 'Offer extended' },
  { value: 'OFFER_DECLINED', label: 'Offer declined' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'POSITION_FILLED', label: 'Position filled' },
] as const;

export default function EmployerJobApplicationsPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<EmployerApplication[]>([]);
  const [matches, setMatches] = useState<JobMatchRow[]>([]);
  const [title, setTitle] = useState('this job');
  const [status, setStatus] = useState('PUBLISHED');
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const matchByApp = useMemo(() => {
    const map = new Map<string, JobMatchRow>();
    for (const row of matches) {
      if (row.applicationId) map.set(row.applicationId, row);
    }
    return map;
  }, [matches]);

  const rankedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ma = matchByApp.get(a.id);
      const mb = matchByApp.get(b.id);
      if (ma && mb) return (ma.rank || 999) - (mb.rank || 999);
      if (ma) return -1;
      if (mb) return 1;
      return (b.match?.score || 0) - (a.match?.score || 0);
    });
  }, [items, matchByApp]);

  async function load() {
    const job = await getEmployerJob(params.id).catch(() => null);
    if (job && typeof job.title === 'string') setTitle(job.title);
    if (job && typeof job.status === 'string') setStatus(job.status);

    const nextItems = await listEmployerApplications(params.id).catch(() => [] as EmployerApplication[]);
    setItems(nextItems);

    const nextMatches = await listJobMatches(params.id).catch(() => [] as JobMatchRow[]);
    setMatches(nextMatches);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [params.id]);

  async function onRank() {
    setRanking(true);
    setError('');
    setMessage('');
    try {
      const next = await recomputeJobMatches(params.id);
      setMatches(next);
      setMessage('Candidates ranked by skills, experience, and interview readiness.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rank candidates.');
    } finally {
      setRanking(false);
    }
  }

  const countLabel =
    matches.length > 0
      ? `${matches.length} matched profile${matches.length === 1 ? '' : 's'}`
      : items.length === 0
        ? 'No matched profiles yet'
        : `${items.length} applicant${items.length === 1 ? '' : 's'}`;

  return (
    <EmployerShellFallback title="Matched candidates">
      <div className="ep-desk">
        <EmployerPageHeader
          title="Matched candidates"
          subtitle={`${title}${loading ? '' : ` · ${countLabel}`}`}
          action={
            <Link href="/employer/applications" className="ep-link">
              ← Applications
            </Link>
          }
        />
        <article className="ep-card ep-list-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!loading ? <StatusBadge status={status} /> : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                block={false}
                loading={ranking}
                loadingLabel="…"
                onClick={() => void onRank()}
              >
                Rank matches
              </Button>
            </div>
          </div>
          {!loading ? <JobStatusActions jobId={params.id} status={status} onUpdated={load} /> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-error">{error}</p> : null}
          {message ? <p className="mt-3 text-sm font-semibold text-teal">{message}</p> : null}
          {loading ? <p className="mt-6 text-sm text-muted">Loading…</p> : null}

          {!loading && matches.length === 0 && items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-primary/20 bg-fog/60 px-5 py-10 text-center">
              <p className="font-semibold text-primary">No matched profiles yet</p>
              <p className="mt-2 text-sm text-muted">Tap Rank matches to score candidates against this job.</p>
              <Button type="button" size="sm" block={false} className="ep-btn-save mt-3" onClick={() => void onRank()}>
                Rank matches
              </Button>
            </div>
          ) : null}

          {!loading && matches.length > 0 ? (
            <div className="mt-6 space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">Ranked talent pool</h2>
              {matches.map((row) => {
                const name =
                  [row.candidate?.firstName, row.candidate?.lastName].filter(Boolean).join(' ') ||
                  'Candidate';
                return (
                  <section key={row.id} className="cb-hire-applicant">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-extrabold text-accent">
                            #{row.rank}
                          </span>
                          <p className="text-lg font-extrabold text-primary">{name}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {row.candidate?.city || 'Location n/a'}
                          {row.candidate?.skills?.length
                            ? ` · ${row.candidate.skills.slice(0, 6).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      {row.applicationId ? (
                        <StatusBadge status="APPLIED" />
                      ) : (
                        <span className="rounded-full bg-fog px-3 py-1 text-xs font-extrabold text-muted">
                          Matched
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      <div className="cb-hire-score">
                        <span>Total</span>
                        <strong>{row.totalScore}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Skills</span>
                        <strong>{row.skillsScore}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Experience</span>
                        <strong>{row.experienceScore}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Interview ready</span>
                        <strong>{row.interviewReadinessScore}</strong>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {!loading && rankedItems.length > 0 ? (
            <div className="mt-8 space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">Applications</h2>
              {rankedItems.map((item) => {
                const rank = matchByApp.get(item.id);
                const name =
                  [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') ||
                  'Candidate';
                return (
                  <section key={item.id} className="cb-hire-applicant">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {rank ? (
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-extrabold text-accent">
                              #{rank.rank}
                            </span>
                          ) : null}
                          <p className="text-lg font-extrabold text-primary">{name}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {item.candidate.city || 'Location n/a'}
                          {item.candidate.skills?.length
                            ? ` · ${item.candidate.skills.slice(0, 6).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      <div className="cb-hire-score">
                        <span>Total</span>
                        <strong>{rank?.totalScore ?? item.match?.score ?? '—'}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Skills</span>
                        <strong>{rank?.skillsScore ?? '—'}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Experience</span>
                        <strong>{rank?.experienceScore ?? '—'}</strong>
                      </div>
                      <div className="cb-hire-score">
                        <span>Interview ready</span>
                        <strong>{rank?.interviewReadinessScore ?? '—'}</strong>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/employer/candidates/${item.candidate.id}?jobId=${encodeURIComponent(params.id)}`}
                        className="ep-link font-extrabold"
                      >
                        View passport
                      </Link>
                      <Link
                        href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(item.id)}&jobId=${encodeURIComponent(params.id)}`}
                        className="ep-link font-extrabold"
                      >
                        Schedule interview
                      </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {ACTIONS.map((action) => (
                        <button
                          key={action.value}
                          type="button"
                          className={`rounded-full border px-3 py-2 text-xs font-extrabold ${
                            action.value === 'HIRE'
                              ? 'border-teal/40 bg-teal/15 text-primary'
                              : 'border-primary/15 bg-white text-primary'
                          }`}
                          onClick={async () => {
                            setError('');
                            try {
                              await changeApplicationStatus(item.id, action.value);
                              if (action.value === 'HIRE') {
                                await recordHiringOutcome(item.id, 'HIRED');
                                setMessage('Candidate hired.');
                              }
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Could not update status.');
                            }
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-primary/8 pt-3">
                      <span className="self-center text-xs font-bold uppercase tracking-wide text-muted">
                        Outcome
                      </span>
                      {OUTCOMES.map((outcome) => (
                        <button
                          key={outcome.value}
                          type="button"
                          className="rounded-full border border-primary/12 px-3 py-1.5 text-xs font-semibold text-primary"
                          onClick={async () => {
                            setError('');
                            try {
                              await recordHiringOutcome(item.id, outcome.value);
                              setMessage(
                                outcome.value === 'HIRED'
                                  ? 'Candidate hired.'
                                  : `Outcome saved: ${outcome.label}.`,
                              );
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Could not save outcome.');
                            }
                          }}
                        >
                          {outcome.label}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
        </article>
      </div>
    </EmployerShellFallback>
  );
}
