'use client';

import { userFacingError } from '@/lib/client-errors';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerJob,
  listEmployerApplications,
  inviteCandidateToJob,
  listJobMatches,
  recomputeJobMatches,
  recordHiringOutcome,
  saveBase64File,
  type JobMatchRow,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerAtsBandChip, EmployerAtsPanel } from '@/components/employer/EmployerAtsPanel';
import { MatchedCandidateCard } from '@/components/employer/MatchedCandidateCard';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import {
  EvAlert,
  EvApplicationPill,
  EvAvatar,
  EvEmpty,
  EvJobStatus,
  EvPageHead,
  EvSkeleton,
} from '@/components/employer/ui';
import { PROFILE_MATCH_LABEL, atsMatchBandLabel, toAtsMatchBreakdown } from '@careerbridge/shared';

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

function formatSalary(min: unknown, max: unknown) {
  return [min, max]
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
    .join(' – ');
}

function displayName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function shortSkill(skill: string) {
  return skill.replace(/^Frontend:\s*/i, '').trim();
}

export default function EmployerJobApplicationsPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<EmployerApplication[]>([]);
  const [matches, setMatches] = useState<JobMatchRow[]>([]);
  const [title, setTitle] = useState('this job');
  const [status, setStatus] = useState('PUBLISHED');
  const [jobDetail, setJobDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [notifyingId, setNotifyingId] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const uniqueMatches = useMemo(() => {
    const seen = new Set<string>();
    const out: JobMatchRow[] = [];
    for (const row of matches) {
      const key = row.candidate?.id || row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [matches]);

  const matchByApp = useMemo(() => {
    const map = new Map<string, JobMatchRow>();
    for (const row of uniqueMatches) {
      if (row.applicationId) map.set(row.applicationId, row);
    }
    return map;
  }, [uniqueMatches]);

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
    setInvitedIds((prev) => {
      const next = new Set(prev);
      for (const row of nextMatches) {
        if (row.invited && row.candidate?.id) next.add(row.candidate.id);
      }
      return next;
    });
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

  async function onViewResume(candidateId: string) {
    setError('');
    try {
      const file = await downloadEmployerCandidateResume(candidateId, params.id);
      if (file.pdf) {
        saveBase64File(file.pdf, file.fileName || 'resume.pdf', file.mimeType || 'application/pdf');
      } else if (file.html) {
        saveBase64File(file.html, file.fileName || 'resume.html', file.mimeType || 'text/html');
      } else {
        setError('Resume file was empty.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open resume.');
    }
  }

  async function onMove(applicationId: string, action: (typeof ACTIONS)[number]['value']) {
    setError('');
    setMessage('');
    try {
      await changeApplicationStatus(applicationId, action);
      if (action === 'HIRE') {
        await recordHiringOutcome(applicationId, 'HIRED');
        setMessage('Candidate hired.');
      } else if (action === 'SHORTLIST') {
        setMessage('Candidate has been shortlisted.');
      }
      await load();
    } catch (err) {
      setError(userFacingError(err, action === 'SHORTLIST' ? 'shortlist candidate' : 'update candidate status'));
    }
  }

  async function onNotifyCandidate(candidateId: string, name: string) {
    setError('');
    setMessage('');
    setNotifyingId(candidateId);
    try {
      const result = await inviteCandidateToJob(candidateId, params.id);
      setInvitedIds((prev) => new Set(prev).add(candidateId));
      setMessage(
        result.alreadyNotified
          ? `${name} was already invited to apply.`
          : `Invite sent to ${name}. They can apply from their notifications.`,
      );
    } catch (err) {
      setError(userFacingError(err, 'notify candidate'));
    } finally {
      setNotifyingId('');
    }
  }

  async function onOutcome(applicationId: string, outcome: (typeof OUTCOMES)[number]) {
    setError('');
    try {
      await recordHiringOutcome(applicationId, outcome.value);
      setMessage(outcome.value === 'HIRED' ? 'Candidate hired.' : `Outcome saved: ${outcome.label}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save outcome.');
    }
  }

  const countLabel =
    matches.length > 0
      ? `${matches.length} matched profile${matches.length === 1 ? '' : 's'}`
      : items.length === 0
        ? 'No matched profiles yet'
        : `${items.length} applicant${items.length === 1 ? '' : 's'}`;

  const salary =
    jobDetail && (jobDetail.salaryMin != null || jobDetail.salaryMax != null)
      ? formatSalary(jobDetail.salaryMin, jobDetail.salaryMax)
      : '';

  return (
    <EmployerShellFallback title="Matched candidates">
      <EvPageHead
        eyebrow="Posted job"
        title={title === 'this job' ? 'Posted job' : title}
        subtitle={`${loading ? '' : `${countLabel} · `}Job details and matched candidates`}
        actions={
          <>
            <Link href="/employer/jobs" className="ev-btn ev-btn--ghost">
              ← My jobs
            </Link>
            <Link href={`/employer/jobs/new?edit=${encodeURIComponent(params.id)}`} className="ev-btn">
              Edit job
            </Link>
          </>
        }
      />

      {loading ? <EvSkeleton height={220} /> : null}

      {!loading && jobDetail ? (
        <article className="ev-card">
          <div className="ev-card-head">
            <div>
              <span className="ev-eyebrow">JOB DETAILS</span>
              <h2 style={{ marginTop: 4 }}>{String(jobDetail.title || title)}</h2>
              <div className="ev-chips">
                {jobDetail.city ? <span className="ev-chip">{String(jobDetail.city)}</span> : null}
                {jobDetail.department ? <span className="ev-chip">{String(jobDetail.department)}</span> : null}
                {jobDetail.jobType ? (
                  <span className="ev-chip">{String(jobDetail.jobType).replaceAll('_', ' ')}</span>
                ) : null}
              </div>
            </div>
            <EvJobStatus status={status} />
          </div>

          <div className="ev-kvl" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))' }}>
            <div>
              <small>EXPERIENCE</small>
              <b>{String(jobDetail.experience || '—')}</b>
            </div>
            <div>
              <small>EDUCATION</small>
              <b>{String(jobDetail.educationMin || '—')}</b>
            </div>
            <div>
              <small>EMPLOYMENT</small>
              <b>{String(jobDetail.jobType || '—').replaceAll('_', ' ')}</b>
            </div>
            {salary ? (
              <div>
                <small>SALARY / MONTH</small>
                <b>{salary}</b>
              </div>
            ) : null}
          </div>

          {jobDetail.description ? (
            <div style={{ marginBottom: 16 }}>
              <span className="ev-eyebrow">DESCRIPTION</span>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>{String(jobDetail.description)}</p>
            </div>
          ) : null}

          <JobStatusActions jobId={params.id} status={status} onUpdated={load} />
        </article>
      ) : null}

      <section className="ev-card ev-mt" aria-labelledby="matched-title">
        <div className="ev-card-head">
          <div>
            <h2 id="matched-title">Matched candidates</h2>
            <p className="ev-sub">
              {loading
                ? 'Loading ranked talent…'
                : uniqueMatches.length > 0
                  ? `${uniqueMatches.length} ranked profile${uniqueMatches.length === 1 ? '' : 's'} for this role`
                  : 'Rank candidates by ATS fit for this job'}
            </p>
          </div>
          <button type="button" className="ev-btn ev-btn--ghost" disabled={ranking} onClick={() => void onRank()}>
            {ranking ? 'Ranking…' : 'Rank matches'}
          </button>
        </div>
        {error ? <EvAlert tone="error">{error}</EvAlert> : null}
        {message ? <EvAlert tone="ok">{message}</EvAlert> : null}

        {!loading && uniqueMatches.length === 0 && items.length === 0 ? (
          <EvEmpty
            title="No matched profiles yet"
            body="Tap Rank matches to score candidates against this job."
            action={
              <button type="button" className="ev-btn" disabled={ranking} onClick={() => void onRank()}>
                Rank matches
              </button>
            }
          />
        ) : null}

        {!loading && uniqueMatches.length > 0 ? (
          <div className="ev-match-grid">
            {uniqueMatches.map((row) => {
              const candidateId = row.candidate?.id;
              const name =
                [row.candidate?.firstName, row.candidate?.lastName].filter(Boolean).join(' ') || 'Candidate';
              return (
                <MatchedCandidateCard
                  key={candidateId || row.id}
                  rank={row.rank}
                  name={name}
                  city={row.candidate?.city}
                  photoUrl={row.candidate?.photoUrl}
                  skills={row.candidate?.skills || []}
                  totalScore={row.totalScore}
                  skillsScore={row.skillsScore}
                  experienceScore={row.experienceScore}
                  reasons={row.reasons}
                  gaps={row.gaps}
                  badge={row.applicationId ? 'applied' : 'matched'}
                  jobId={params.id}
                  candidateId={candidateId}
                  invited={Boolean(candidateId && invitedIds.has(candidateId))}
                  notifying={notifyingId === candidateId}
                  onNotify={candidateId ? () => void onNotifyCandidate(candidateId, name) : undefined}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      {!loading && rankedItems.length > 0 ? (
        <section className="ev-mt" aria-labelledby="job-applications-title">
          <h2 id="job-applications-title">Applications</h2>
          <div className="ev-appcard-list">
            {rankedItems.map((item) => {
              const rank = matchByApp.get(item.id);
              const rawName =
                [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
              const name = displayName(rawName);
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
              const skillPreview = (item.candidate.skills || []).slice(0, 5).map(shortSkill);
              const moreSkills = Math.max((item.candidate.skills || []).length - skillPreview.length, 0);
              return (
                <article key={item.id} className="ev-card ev-appcard">
                  <header className="ev-appcard__head">
                    <EvAvatar name={name} photoUrl={item.candidate.photoUrl} size="lg" />
                    <div className="ev-appcard__who">
                      <h3>
                        <span className="ev-appcard__name">{name}</span>
                        {rank ? <span className="ev-tag">#{rank.rank}</span> : null}
                      </h3>
                      <p className="ev-sub">{location}</p>
                      {skillPreview.length > 0 ? (
                        <div className="ev-chips" aria-label="Skills">
                          {skillPreview.map((skill) => (
                            <span key={skill} className="ev-chip">
                              {skill}
                            </span>
                          ))}
                          {moreSkills > 0 ? <span className="ev-chip">+{moreSkills}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="ev-appcard__badges">
                      {atsScore != null ? <EmployerAtsBandChip score={atsScore} /> : null}
                      <EvApplicationPill status={item.status} />
                    </div>
                  </header>

                  <div className="ev-appcard__body">
                    <div className="ev-appcard__match">
                      {item.match ? (
                        <EmployerAtsPanel match={item.match} compact />
                      ) : (
                        <div className="ev-kvl ev-appcard__fallback">
                          <div>
                            <small>{PROFILE_MATCH_LABEL.toUpperCase()}</small>
                            <b>{rank?.totalScore ?? '—'}</b>
                          </div>
                          <div>
                            <small>SKILLS</small>
                            <b>{rank?.skillsScore ?? '—'}</b>
                          </div>
                          <div>
                            <small>EXPERIENCE</small>
                            <b>{rank?.experienceScore ?? '—'}</b>
                          </div>
                          <div>
                            <small>BAND</small>
                            <b>{rank ? atsMatchBandLabel(rank.totalScore).replace(' Match', '') : '—'}</b>
                          </div>
                        </div>
                      )}

                      {breakdown ? null : rank?.reasons?.length || rank?.gaps?.length ? (
                        <div className="ev-explain">
                          {rank?.reasons?.length ? (
                            <div>
                              <h3>Why this match</h3>
                              <ul className="ev-list ev-list--ok">
                                {rank.reasons.slice(0, 4).map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {rank?.gaps?.length ? (
                            <div>
                              <h3>Missing / weaker</h3>
                              <ul className="ev-list ev-list--gap">
                                {rank.gaps.slice(0, 4).map((gap) => (
                                  <li key={gap}>{gap}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="ev-appcard__ops">
                      <nav className="ev-appcard__docs" aria-label="Candidate documents">
                        <Link
                          href={`/employer/candidates/${item.candidate.id}?jobId=${encodeURIComponent(params.id)}`}
                          className="ev-btn ev-btn--ghost ev-btn--sm"
                        >
                          View passport
                        </Link>
                        <button
                          type="button"
                          className="ev-btn ev-btn--ghost ev-btn--sm"
                          onClick={() => void onViewResume(item.candidate.id)}
                        >
                          View resume
                        </button>
                        <Link
                          href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(item.id)}&jobId=${encodeURIComponent(params.id)}`}
                          className="ev-btn ev-btn--sm"
                        >
                          Schedule interview
                        </Link>
                      </nav>

                      <section className="ev-pipe" aria-label="Move candidate">
                        <h4 className="ev-pipe__label">Move candidate</h4>
                        <div className="ev-pipe__track" role="group">
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
                                className={`ev-chipbtn${active ? ' on' : ''}`}
                                aria-pressed={active}
                                onClick={() => void onMove(item.id, action.value)}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="ev-pipe ev-pipe--outcome" aria-label="Hiring outcome">
                        <h4 className="ev-pipe__label">Outcome</h4>
                        <div className="ev-pipe__track" role="group">
                          {OUTCOMES.map((outcome) => (
                            <button
                              key={outcome.value}
                              type="button"
                              className="ev-chipbtn"
                              onClick={() => void onOutcome(item.id, outcome)}
                            >
                              {outcome.label}
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </EmployerShellFallback>
  );
}
