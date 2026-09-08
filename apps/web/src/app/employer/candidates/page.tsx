'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerCandidateSearchResult, EmployerJobSummary } from '@careerbridge/shared';
import { listEmployerJobs, searchEmployerCandidates, changeApplicationStatus } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

function candidateName(row: EmployerCandidateSearchResult) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function initials(row: EmployerCandidateSearchResult) {
  const first = row.firstName?.trim()?.[0] || '';
  const last = row.lastName?.trim()?.[0] || '';
  return (first + last || 'C').toUpperCase();
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

  useEffect(() => {
    listEmployerJobs()
      .then((rows) => {
        setJobs(rows);
        if (rows[0]?.id) setJobId(rows[0].id);
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobs, jobId]);

  async function runSearch() {
    if (!jobId) {
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
        jobId,
      });
      setResults(data.candidates ?? []);
      setUnlockLimit(data.unlockLimit);
      setTotalMatched(data.totalMatched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not search candidates.';
      setError(message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function clearFilters() {
    setQ('');
    setCity('');
    setSkill('');
    setExperienceMin('');
    setError('');
    setMessage('');
    setResults([]);
    setHasSearched(false);
    setUnlockLimit(0);
    setTotalMatched(0);
  }

  async function shortlist(applicationId: string) {
    setBusyId(applicationId);
    setError('');
    setMessage('');
    try {
      await changeApplicationStatus(applicationId, 'SHORTLIST');
      setMessage('Candidate shortlisted.');
      await runSearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not shortlist.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <EmployerShellFallback title="Candidates">
      <div className="ep-cand">
        <div className="ep-cand__shell">
          <header className="ep-cand__head">
            <h1 className="ep-cand__title">Search candidates</h1>
            <p className="ep-cand__sub">
              Find ranked matches for your open roles — free while we are in early access.
            </p>
          </header>

          <form
            className="ep-cand__card"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
          >
            <div className="ep-cand__hero-band">
              <span className="ep-cand__band-label">Match against job</span>
              <span className="ep-cand__band-dot" aria-hidden>
                ·
              </span>
              <span className="ep-cand__band-copy">
                {selectedJob
                  ? `${selectedJob.title}${selectedJob.city ? ` · ${selectedJob.city}` : ''}`
                  : 'Choose an active posting to rank candidates'}
              </span>
              <span className="ep-cand__band-dot" aria-hidden>
                ·
              </span>
              <span className="ep-cand__band-pill">{jobs.length} jobs</span>
            </div>

            <label className="ep-cand__field">
              <span>Job</span>
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setResults([]);
                  setHasSearched(false);
                  setError('');
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
              <label className="ep-cand__field">
                <span>Skill</span>
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="e.g. Communication"
                />
              </label>
              <label className="ep-cand__field">
                <span>City</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Chennai"
                />
              </label>
              <label className="ep-cand__field">
                <span>Min experience</span>
                <input
                  type="number"
                  min={0}
                  value={experienceMin}
                  onChange={(e) => setExperienceMin(e.target.value)}
                  placeholder="0"
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
                Clear
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
                <div className="ep-cand__empty-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M15 15.5 19.5 20"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p>Ready when you are</p>
                <span>Pick a job, refine filters if needed, then search.</span>
              </div>
            ) : null}

            {!loading && !searching && hasSearched && (results?.length ?? 0) === 0 ? (
              <div className="ep-cand__empty-state">
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
                      {results.length} of {totalMatched} matched
                    </p>
                  ) : null}
                </div>

                <ul className="ep-cand__list">
                  {results.map((row) => (
                    <li key={row.id} className="ep-cand__row">
                      <div className="ep-cand__avatar" aria-hidden>
                        {initials(row)}
                      </div>
                      <div className="ep-cand__info">
                        <p className="ep-cand__name">{candidateName(row)}</p>
                        <p className="ep-cand__meta">
                          {[row.city, row.experienceYears != null ? `${row.experienceYears} yrs` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Profile available'}
                        </p>
                        {row.skills.length ? (
                          <div className="ep-cand__skills">
                            {row.skills.slice(0, 4).map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="ep-cand__side">
                        {row.matchScore !== null ? (
                          <span className="ep-cand__score">{row.matchScore}%</span>
                        ) : null}
                        <Link
                          href={`/employer/candidates/${row.id}?jobId=${encodeURIComponent(jobId)}`}
                          className="ep-cand__view"
                        >
                          View
                        </Link>
                        {row.applicationId ? (
                          <button
                            type="button"
                            className="ep-cand__shortlist"
                            disabled={busyId === row.applicationId}
                            onClick={() => void shortlist(row.applicationId!)}
                          >
                            {busyId === row.applicationId ? '…' : 'Shortlist'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </EmployerShellFallback>
  );
}
