'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerCandidateSearchResult, EmployerJobSummary } from '@careerbridge/shared';
import { JOB_SKILL_SUGGESTIONS } from '@careerbridge/shared';
import {
  listEmployerJobs,
  searchEmployerCandidates,
  changeApplicationStatus,
  notifyMatchedCandidate,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerEmptyCue } from '@/components/employer/EmployerEmptyCue';
import { ShortlistConfirmModal } from '@/components/employer/ShortlistConfirmModal';
import { Button } from '@/components/ui/Button';
import { CitySelect } from '@/components/ui/CitySelect';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';
import { ALL_SKILL_OPTIONS } from '@/data/technology-skills';

const SKILL_FILTER_OPTIONS = Array.from(
  new Set([...JOB_SKILL_SUGGESTIONS, ...ALL_SKILL_OPTIONS]),
).sort((a, b) => a.localeCompare(b));

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function candidateName(row: EmployerCandidateSearchResult) {
  const raw = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return raw ? titleCaseName(raw) : 'Candidate';
}

function initials(row: EmployerCandidateSearchResult) {
  const first = row.firstName?.trim()?.[0] || '';
  const last = row.lastName?.trim()?.[0] || '';
  return (first + last || 'C').toUpperCase();
}

/** Collapse duplicate city/state fragments like "Bangalore, Bihar, Bihar…". */
function formatLocation(city?: string | null, state?: string | null) {
  const parts = [...(city || '').split(/[,|/·]+/), state || '']
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(', ') || 'Location not set';
}

function formatExperience(row: EmployerCandidateSearchResult) {
  const years = row.experienceYears || 0;
  const months = row.experienceMonths || 0;
  if (years <= 0 && months <= 0) return 'Fresher';
  if (years <= 0) return `${months} mo`;
  if (months > 0) return `${years} yr${years === 1 ? '' : 's'} ${months} mo`;
  return `${years} yr${years === 1 ? '' : 's'}`;
}

export default function EmployerCandidatesPage() {
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [skill, setSkill] = useState('');
  const [experienceMin, setExperienceMin] = useState('');
  const [jobId, setJobId] = useState('');
  const [results, setResults] = useState<EmployerCandidateSearchResult[]>([]);
  const [unlockLimit, setUnlockLimit] = useState(0);
  const [totalMatched, setTotalMatched] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [shortlistTarget, setShortlistTarget] = useState<{
    applicationId: string;
    name: string;
  } | null>(null);

  async function runSearch(selectedJobId: string) {
    if (!selectedJobId) {
      setError('Select a job to search matched candidates.');
      return;
    }
    setSearching(true);
    setError('');
    setHasSearched(true);
    try {
      const data = await searchEmployerCandidates({
        q: q.trim() || undefined,
        city: city.trim() || undefined,
        skill: skill.trim() || undefined,
        experienceMin: experienceMin ? Number(experienceMin) : undefined,
        jobId: selectedJobId,
      });
      setResults(data.candidates ?? []);
      setUnlockLimit(data.unlockLimit);
      setTotalMatched(data.totalMatched);
    } catch (err) {
      const next = err instanceof Error ? err.message : 'Could not search candidates.';
      setError(next);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    listEmployerJobs()
      .then(async (rows) => {
        setJobs(rows);
        const firstId = rows[0]?.id || '';
        if (firstId) {
          setJobId(firstId);
          await runSearch(firstId);
        }
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobs, jobId]);

  function clearFilters() {
    setQ('');
    setCity('');
    setSkill('');
    setExperienceMin('');
    setError('');
    setMessage('');
    if (jobId) void runSearch(jobId);
  }

  async function shortlist(applicationId: string, _note?: string) {
    setBusyId(applicationId);
    setError('');
    setMessage('');
    try {
      await changeApplicationStatus(applicationId, 'SHORTLIST');
      setMessage('Candidate has been shortlisted.');
      setShortlistTarget(null);
      await runSearch(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not shortlist.');
    } finally {
      setBusyId('');
    }
  }

  async function notify(candidateId: string) {
    if (!jobId) return;
    setBusyId(`notify-${candidateId}`);
    setError('');
    setMessage('');
    try {
      const result = await notifyMatchedCandidate(candidateId, jobId);
      setNotifiedIds((prev) => new Set(prev).add(candidateId));
      setMessage(
        result.whatsappSent
          ? 'WhatsApp message sent to this candidate.'
          : 'Candidate notified in-app. WhatsApp number was not available.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify candidate.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <EmployerShellFallback title="Candidates">
      <div className="ep-cand ep-page ep-page--candidates">
        <div className="ep-cand__shell">
          <header className="ep-cand__intro">
            <div>
              <p className="ep-cand__intro-eyebrow">Talent pool</p>
              <h1 className="ep-cand__intro-title">Candidates</h1>
              <p className="ep-cand__intro-sub">
                Ranked matches for your open roles. Notify via WhatsApp or shortlist from each profile.
              </p>
            </div>
            {selectedJob ? (
              <div className="ep-cand__intro-job">
                <span>Matching</span>
                <strong>{selectedJob.title}</strong>
              </div>
            ) : null}
          </header>

          <form
            className="ep-cand__card ep-cand__card--search"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(jobId);
            }}
          >
            <label className="ep-cand__field ep-cand__field--job">
              <span>Match against job</span>
              <select
                value={jobId}
                onChange={(e) => {
                  const next = e.target.value;
                  setJobId(next);
                  setResults([]);
                  setHasSearched(false);
                  setError('');
                  setMessage('');
                  if (next) void runSearch(next);
                }}
                disabled={loading}
                required
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.city ? ` · ${job.city}` : ''}
                    {job.status ? ` (${job.status === 'PUBLISHED' ? 'Active' : job.status})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="ep-cand__filters">
              <div className="ep-cand__field">
                <SearchableCreatableSelect
                  id="cand-skill"
                  label="Skill"
                  value={skill}
                  onChange={setSkill}
                  options={SKILL_FILTER_OPTIONS}
                  placeholder="Search skill…"
                  allowCustom
                  emptyLimit={40}
                />
              </div>
              <div className="ep-cand__field">
                <CitySelect
                  id="cand-city"
                  label="City"
                  value={city}
                  onChange={setCity}
                />
              </div>
              <label className="ep-cand__field">
                <span>Min experience</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.1"
                  inputMode="decimal"
                  value={experienceMin}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === '') {
                      setExperienceMin('');
                      return;
                    }
                    if (/^\d*\.?\d{0,2}$/.test(next)) setExperienceMin(next);
                  }}
                  placeholder="e.g. 0, 1, 2.5"
                />
              </label>
              <label className="ep-cand__field">
                <span>Name / keyword</span>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            {error ? <p className="ep-cand__error">{error}</p> : null}
            {message ? <p className="ep-cand__ok">{message}</p> : null}

            <div className="ep-cand__actions">
              <button type="button" className="ep-cand__clear" onClick={clearFilters}>
                Clear filters
              </button>
              <Button
                type="submit"
                loading={searching}
                loadingLabel="Searching…"
                block={false}
                disabled={!jobId || loading}
                className="ep-cand__submit"
              >
                Search candidates
              </Button>
            </div>
          </form>

          <section className="ep-cand__results" aria-live="polite">
            {loading ? <p className="ep-cand__empty">Loading jobs…</p> : null}
            {!loading && searching ? <p className="ep-cand__empty">Searching matched candidates…</p> : null}

            {!loading && !searching && !hasSearched ? (
              <div className="ep-cand__empty-state">
                <EmployerEmptyCue cue="search" />
                <p>Select a job to see candidates</p>
                <span>Matched candidates load automatically for your roles.</span>
              </div>
            ) : null}

            {!loading && !searching && hasSearched && (results?.length ?? 0) === 0 ? (
              <div className="ep-cand__empty-state">
                <EmployerEmptyCue cue="search" />
                <p>No candidates found</p>
                <span>Try broader filters or another job posting.</span>
              </div>
            ) : null}

            {!loading && !searching && (results?.length ?? 0) > 0 ? (
              <>
                <div className="ep-cand__results-head">
                  <h2 className="ep-cand__results-title">Matched candidates</h2>
                  {selectedJob && unlockLimit > 0 ? (
                    <p className="ep-cand__results-meta">
                      Showing {results.length} of {totalMatched}
                    </p>
                  ) : null}
                </div>

                <ul className="ep-cand__list">
                  {results.map((row) => {
                    const notified = notifiedIds.has(row.id);
                    const canShortlist =
                      Boolean(row.applicationId) &&
                      row.applicationStatus !== 'SHORTLISTED' &&
                      row.applicationStatus !== 'SELECTED' &&
                      row.applicationStatus !== 'HIRED';
                    const visibleSkills = row.skills.slice(0, 3);
                    const moreSkills = Math.max((row.skillsTotal || row.skills.length) - visibleSkills.length, 0);
                    const availabilityTone = row.availabilityTone || 'neutral';

                    return (
                      <li key={row.id} className="ep-cand__box">
                        <div className="ep-cand__box-top">
                          <div className="ep-cand__avatar" aria-hidden>
                            {initials(row)}
                          </div>
                          <div className="ep-cand__box-identity">
                            <p className="ep-cand__name">{candidateName(row)}</p>
                            <p className="ep-cand__meta">{formatLocation(row.city, row.state)}</p>
                          </div>
                          {row.matchScore !== null ? (
                            <span className="ep-cand__score" title="ATS match for selected job">
                              {row.matchScore}/100
                            </span>
                          ) : null}
                        </div>

                        <div className="ep-cand__stats">
                          <div>
                            <span>Experience</span>
                            <strong>{formatExperience(row)}</strong>
                          </div>
                          <div>
                            <span>Availability</span>
                            <strong className={`ep-cand__avail ep-cand__avail--${availabilityTone}`}>
                              {row.availabilityLabel || 'Available'}
                            </strong>
                          </div>
                        </div>

                        {visibleSkills.length ? (
                          <div className="ep-cand__skills">
                            {visibleSkills.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                            {moreSkills > 0 ? <span className="ep-cand__skills-more">+{moreSkills}</span> : null}
                          </div>
                        ) : (
                          <div className="ep-cand__skills">
                            <span className="ep-cand__skills-empty">No skills listed</span>
                          </div>
                        )}

                        <div className="ep-cand__actions-row">
                          <Link
                            href={`/employer/candidates/${row.id}?jobId=${encodeURIComponent(jobId)}`}
                            className="ep-cand__btn ep-cand__btn--ghost"
                          >
                            View profile
                          </Link>
                          {canShortlist ? (
                            <button
                              type="button"
                              className="ep-cand__btn ep-cand__btn--solid"
                              disabled={busyId === row.applicationId}
                              onClick={() =>
                                setShortlistTarget({
                                  applicationId: row.applicationId!,
                                  name: candidateName(row),
                                })
                              }
                            >
                              {busyId === row.applicationId ? '…' : 'Shortlist'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="ep-cand__btn ep-cand__btn--wa"
                            disabled={busyId === `notify-${row.id}` || !jobId || notified}
                            onClick={() => void notify(row.id)}
                            title="Send WhatsApp invite to this candidate only"
                          >
                            {busyId === `notify-${row.id}`
                              ? '…'
                              : notified
                                ? 'WhatsApp sent'
                                : 'Notify via WhatsApp'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </section>
        </div>
      </div>

      <ShortlistConfirmModal
        open={Boolean(shortlistTarget)}
        candidateName={shortlistTarget?.name || 'Candidate'}
        jobTitle={selectedJob?.title}
        busy={Boolean(shortlistTarget && busyId === shortlistTarget.applicationId)}
        onCancel={() => setShortlistTarget(null)}
        onConfirm={(note) => {
          if (!shortlistTarget) return;
          return shortlist(shortlistTarget.applicationId, note);
        }}
      />
    </EmployerShellFallback>
  );
}
