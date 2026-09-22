'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerJob,
  listEmployerApplications,
  listJobMatches,
  recomputeJobMatches,
  recordHiringOutcome,
  saveBase64File,
  type JobMatchRow,
} from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { EmployerAtsBandChip, EmployerAtsPanel } from '@/components/employer/EmployerAtsPanel';
import { MatchedCandidateCard } from '@/components/employer/MatchedCandidateCard';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { StatusBadge } from '@/components/AppNav';
import { Button } from '@/components/ui/Button';
import { atsMatchBandLabel, toAtsMatchBreakdown } from '@careerbridge/shared';

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
  const [jobDetail, setJobDetail] = useState<Record<string, unknown> | null>(null);
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
    if (job) {
      setJobDetail(job as Record<string, unknown>);
      if (typeof job.title === 'string') setTitle(job.title);
      if (typeof job.status === 'string') setStatus(job.status);
    }

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
      setMessage('Candidates ranked by ATS match for this job (skills, experience, and semantic fit).');
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
          title={title === 'this job' ? 'Posted job' : title}
          subtitle={`${loading ? '' : countLabel}${loading ? '' : ' · '}Job details and matched candidates`}
          action={
            <Link href="/employer/jobs" className="ep-link">
              ← My Jobs
            </Link>
          }
        />

        {!loading && jobDetail ? (
          <article className="ep-job-detail">
            <header className="ep-job-detail__head">
              <div className="ep-job-detail__intro">
                <div className="ep-job-detail__kicker">
                  <p className="ep-job-detail__eyebrow">Posted job</p>
                  <StatusBadge status={status} />
                </div>
                <h2 className="ep-job-detail__title">{String(jobDetail.title || title)}</h2>
                <ul className="ep-job-detail__chips">
                  {jobDetail.city ? <li>{String(jobDetail.city)}</li> : null}
                  {jobDetail.department ? <li>{String(jobDetail.department)}</li> : null}
                  {jobDetail.jobType ? (
                    <li>{String(jobDetail.jobType).replaceAll('_', ' ')}</li>
                  ) : null}
                </ul>
              </div>
            </header>

            <div className="ep-job-detail__facts">
              <div className="ep-job-detail__fact">
                <span>Experience</span>
                <strong>{String(jobDetail.experience || '—')}</strong>
              </div>
              <div className="ep-job-detail__fact">
                <span>Education</span>
                <strong>{String(jobDetail.educationMin || '—')}</strong>
              </div>
              <div className="ep-job-detail__fact">
                <span>Employment</span>
                <strong>{String(jobDetail.jobType || '—').replaceAll('_', ' ')}</strong>
              </div>
              {(jobDetail.salaryMin != null || jobDetail.salaryMax != null) ? (
                <div className="ep-job-detail__fact ep-job-detail__fact--salary">
                  <span>Salary / month</span>
                  <strong>
                    {[jobDetail.salaryMin, jobDetail.salaryMax]
                      .filter((v) => v != null)
                      .map((v) => {
                        const n = Number(v);
                        if (!Number.isFinite(n)) return String(v);
                        if (n >= 100000) {
                          const lakhs = n / 100000;
                          return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2)}L`;
                        }
                        if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
                        return `₹${n}`;
                      })
                      .join(' – ')}
                  </strong>
                </div>
              ) : null}
            </div>

            {jobDetail.description ? (
              <div className="ep-job-detail__desc">
                <span>Description</span>
                <p>{String(jobDetail.description)}</p>
              </div>
            ) : null}

            <footer className="ep-job-detail__actions">
              <Link
                href={`/employer/jobs/new?edit=${encodeURIComponent(params.id)}`}
                className="ep-job-detail__edit"
              >
                Edit job
              </Link>
              <div className="ep-job-detail__status-actions">
                <JobStatusActions jobId={params.id} status={status} onUpdated={load} />
              </div>
            </footer>
          </article>
        ) : null}

        <article className="ep-card ep-list-card ep-match-section">
          <div className="ep-match-section__toolbar">
            <div>
              <h2>Matched candidates</h2>
              <p>
                {loading
                  ? 'Loading ranked talent…'
                  : matches.length > 0
                    ? `${matches.length} ranked profile${matches.length === 1 ? '' : 's'} for this role`
                    : 'Rank candidates by ATS fit for this job'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              block={false}
              loading={ranking}
              loadingLabel="Ranking…"
              onClick={() => void onRank()}
              className="ep-match-section__rank-btn"
            >
              Rank matches
            </Button>
          </div>
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
            <div className="ep-match-pool">
              {matches.map((row) => {
                const name =
                  [row.candidate?.firstName, row.candidate?.lastName].filter(Boolean).join(' ') ||
                  'Candidate';
                return (
                  <MatchedCandidateCard
                    key={row.id}
                    rank={row.rank}
                    name={name}
                    city={row.candidate?.city}
                    skills={row.candidate?.skills || []}
                    totalScore={row.totalScore}
                    skillsScore={row.skillsScore}
                    experienceScore={row.experienceScore}
                    reasons={row.reasons}
                    gaps={row.gaps}
                    badge={row.applicationId ? 'applied' : 'matched'}
                    jobId={params.id}
                    candidateId={row.candidate?.id}
                  />
                );
              })}
            </div>
          ) : null}

          {!loading && rankedItems.length > 0 ? (
            <div className="ep-applicant-list">
              <h2 className="ep-applicant-list__title">Applications</h2>
              {rankedItems.map((item) => {
                const rank = matchByApp.get(item.id);
                const name =
                  [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') ||
                  'Candidate';
                const atsScore = item.match?.score ?? rank?.totalScore ?? null;
                const breakdown = item.match ? toAtsMatchBreakdown(item.match) : null;
                const locationParts = (item.candidate.city || '')
                  .split(/[,|/·•]+/)
                  .map((p) => p.trim())
                  .filter(Boolean);
                const uniqueLoc: string[] = [];
                for (const part of locationParts) {
                  if (!uniqueLoc.some((u) => u.toLowerCase() === part.toLowerCase())) {
                    uniqueLoc.push(part);
                  }
                }
                const location = uniqueLoc.slice(0, 2).join(', ') || 'Location n/a';
                const skillPreview = (item.candidate.skills || [])
                  .slice(0, 5)
                  .map((s) => s.replace(/^Frontend:\s*/i, '').trim());
                return (
                  <section key={item.id} className="ep-applicant">
                    <header className="ep-applicant__head">
                      <div className="ep-applicant__identity">
                        <div className="ep-applicant__name-row">
                          {rank ? <span className="ep-applicant__rank">#{rank.rank}</span> : null}
                          <h3 className="ep-applicant__name">{name}</h3>
                          {atsScore != null ? <EmployerAtsBandChip score={atsScore} /> : null}
                        </div>
                        <p className="ep-applicant__meta">
                          <span>{location}</span>
                          {skillPreview.length > 0 ? (
                            <span className="ep-applicant__skills">{skillPreview.join(' · ')}</span>
                          ) : null}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </header>

                    {item.match ? (
                      <EmployerAtsPanel match={item.match} compact className="ep-applicant__ats" />
                    ) : (
                      <div className="ep-applicant__stats">
                        <div className="ep-applicant__stat">
                          <span>ATS score</span>
                          <strong>{rank?.totalScore ?? '—'}</strong>
                        </div>
                        <div className="ep-applicant__stat">
                          <span>Skills</span>
                          <strong>{rank?.skillsScore ?? '—'}</strong>
                        </div>
                        <div className="ep-applicant__stat">
                          <span>Experience</span>
                          <strong>{rank?.experienceScore ?? '—'}</strong>
                        </div>
                        <div className="ep-applicant__stat">
                          <span>Band</span>
                          <strong>
                            {rank ? atsMatchBandLabel(rank.totalScore).replace(' Match', '') : '—'}
                          </strong>
                        </div>
                      </div>
                    )}

                    {breakdown ? null : (rank?.reasons?.length || rank?.gaps?.length) ? (
                      <div className="ep-applicant__notes">
                        {rank?.reasons?.length ? (
                          <div>
                            <p className="ep-applicant__notes-label">Why this match</p>
                            <ul>
                              {rank.reasons.slice(0, 4).map((reason) => (
                                <li key={reason} className="ep-applicant__ok">
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {rank?.gaps?.length ? (
                          <div>
                            <p className="ep-applicant__notes-label">Missing / weaker</p>
                            <ul>
                              {rank.gaps.slice(0, 4).map((gap) => (
                                <li key={gap} className="ep-applicant__gap">
                                  {gap}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <nav className="ep-applicant__links" aria-label="Candidate documents">
                      <Link
                        href={`/employer/candidates/${item.candidate.id}?jobId=${encodeURIComponent(params.id)}`}
                        className="ep-applicant__link"
                      >
                        View passport
                      </Link>
                      <button
                        type="button"
                        className="ep-applicant__link"
                        onClick={async () => {
                          setError('');
                          try {
                            const file = await downloadEmployerCandidateResume(item.candidate.id, params.id);
                            if (file.pdf) {
                              saveBase64File(
                                file.pdf,
                                file.fileName || 'resume.pdf',
                                file.mimeType || 'application/pdf',
                              );
                            } else if (file.html) {
                              saveBase64File(
                                file.html,
                                file.fileName || 'resume.html',
                                file.mimeType || 'text/html',
                              );
                            } else {
                              setError('Resume file was empty.');
                            }
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Could not open resume.');
                          }
                        }}
                      >
                        View resume
                      </button>
                      <Link
                        href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(item.id)}&jobId=${encodeURIComponent(params.id)}`}
                        className="ep-applicant__link"
                      >
                        Schedule interview
                      </Link>
                    </nav>

                    <div className="ep-applicant__pipeline" role="group" aria-label="Move candidate">
                      {ACTIONS.map((action) => {
                        const active =
                          (action.value === 'REVIEW' && item.status === 'UNDER_REVIEW') ||
                          (action.value === 'SHORTLIST' && item.status === 'SHORTLISTED') ||
                          (action.value === 'INTERVIEW' && item.status === 'INTERVIEW') ||
                          (action.value === 'SELECT' && item.status === 'SELECTED') ||
                          (action.value === 'HIRE' && item.status === 'HIRED') ||
                          (action.value === 'REJECT' && item.status === 'REJECTED');
                        return (
                          <button
                            key={action.value}
                            type="button"
                            className={`ep-applicant__stage${action.value === 'HIRE' ? ' is-hire' : ''}${
                              active ? ' is-active' : ''
                            }`}
                            onClick={async () => {
                              setError('');
                              setMessage('');
                              try {
                                await changeApplicationStatus(item.id, action.value);
                                if (action.value === 'HIRE') {
                                  await recordHiringOutcome(item.id, 'HIRED');
                                  setMessage('Candidate hired.');
                                } else if (action.value === 'SHORTLIST') {
                                  setMessage('Candidate has been shortlisted.');
                                }
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Could not update status.');
                              }
                            }}
                          >
                            {action.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="ep-applicant__outcome" role="group" aria-label="Hiring outcome">
                      <span className="ep-applicant__outcome-label">Outcome</span>
                      {OUTCOMES.map((outcome) => (
                        <button
                          key={outcome.value}
                          type="button"
                          className="ep-applicant__outcome-btn"
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
