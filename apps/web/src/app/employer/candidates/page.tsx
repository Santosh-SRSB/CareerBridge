'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EmployerCandidateSearchResult, EmployerJobSummary } from '@careerbridge/shared';
import {
  CANDIDATE_AVAILABILITY_FILTERS,
  CANDIDATE_EDUCATION_FILTERS,
  CANDIDATE_EXPERIENCE_FILTERS,
  CANDIDATE_SEARCH_MAX_SKILLS,
  CANDIDATE_SEARCH_SORTS,
  DEFAULT_LANGUAGES,
  JOB_SKILL_SUGGESTIONS,
  PROFILE_MATCH_LABEL,
  atsMatchBand,
} from '@careerbridge/shared';
import {
  listEmployerJobs,
  searchEmployerCandidates,
  changeApplicationStatus,
  setTalentShortlist,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerEmptyCue } from '@/components/employer/EmployerEmptyCue';
import { ShortlistConfirmModal } from '@/components/employer/ShortlistConfirmModal';
import { Button } from '@/components/ui/Button';
import { CitySelect } from '@/components/ui/CitySelect';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { ALL_SKILL_OPTIONS } from '@/data/technology-skills';
import { useCatalog } from '@/hooks/useCatalog';
import { jobStatusLabel } from '@/lib/job-status';

const SKILL_FILTER_OPTIONS = Array.from(
  new Set([...JOB_SKILL_SUGGESTIONS, ...ALL_SKILL_OPTIONS]),
).sort((a, b) => a.localeCompare(b));

const PAGE_SIZE = 10;

type CandidateFilters = {
  q: string;
  city: string;
  skills: string[];
  experience: string;
  language: string;
  education: string;
  availability: string;
  sort: string;
};

const EMPTY_FILTERS: CandidateFilters = {
  q: '',
  city: '',
  skills: [],
  experience: '',
  language: '',
  education: '',
  availability: '',
  sort: 'match',
};

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
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const { items: languageOptions } = useCatalog('languages', DEFAULT_LANGUAGES);
  const [skillDraft, setSkillDraft] = useState('');
  const [skillError, setSkillError] = useState('');
  const [jobId, setJobId] = useState('');
  const [results, setResults] = useState<EmployerCandidateSearchResult[]>([]);
  const [unlockLimit, setUnlockLimit] = useState(0);
  const [totalMatched, setTotalMatched] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobsError, setJobsError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [shortlistError, setShortlistError] = useState('');
  const [shortlistTarget, setShortlistTarget] = useState<{
    candidateId: string;
    applicationId: string | null;
    name: string;
  } | null>(null);

  function patchFilters(patch: Partial<CandidateFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function runSearch(selectedJobId: string, f: CandidateFilters = filters, nextPage = 1) {
    if (!selectedJobId) {
      setError('Select a job to search matched candidates.');
      return;
    }
    setSearching(true);
    setError('');
    setLoadFailed(false);
    setHasSearched(true);
    try {
      const data = await searchEmployerCandidates({
        q: f.q.trim() || undefined,
        city: f.city.trim() || undefined,
        skills: f.skills.length ? f.skills : undefined,
        experience: f.experience || undefined,
        language: f.language || undefined,
        education: f.education || undefined,
        availability: f.availability || undefined,
        sort: f.sort && f.sort !== 'match' ? f.sort : undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
        jobId: selectedJobId,
      });
      setResults(data.candidates ?? []);
      setUnlockLimit(data.unlockLimit);
      setTotalMatched(data.totalMatched);
      setTotal(data.total ?? data.candidates?.length ?? 0);
      setPage(data.page ?? nextPage);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        setError(userFacingError(err, 'search candidates'));
      } else {
        setLoadFailed(true);
      }
      setResults([]);
      setTotal(0);
    } finally {
      setSearching(false);
    }
  }

  function loadJobs() {
    setLoading(true);
    setJobsError(false);
    listEmployerJobs()
      .then(async (rows) => {
        setJobs(rows);
        const firstId = rows[0]?.id || '';
        if (firstId) {
          setJobId(firstId);
          await runSearch(firstId, EMPTY_FILTERS);
        }
      })
      .catch(() => {
        setJobs([]);
        setJobsError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobs, jobId]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function addSkill(value: string) {
    const next = value.trim();
    if (!next) return;
    if (filters.skills.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    if (filters.skills.length >= CANDIDATE_SEARCH_MAX_SKILLS) {
      setSkillError(`You can filter by up to ${CANDIDATE_SEARCH_MAX_SKILLS} skills.`);
      setSkillDraft('');
      return;
    }
    setSkillError('');
    patchFilters({ skills: [...filters.skills, next] });
    setSkillDraft('');
  }

  function removeSkill(value: string) {
    setSkillError('');
    patchFilters({ skills: filters.skills.filter((item) => item !== value) });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSkillDraft('');
    setSkillError('');
    setError('');
    if (jobId) void runSearch(jobId, EMPTY_FILTERS);
  }

  async function shortlist(target: { candidateId: string; applicationId: string | null }, note?: string) {
    setBusyId(`shortlist-${target.candidateId}`);
    setShortlistError('');
    try {
      if (target.applicationId) {
        await changeApplicationStatus(target.applicationId, 'SHORTLIST', undefined, note || undefined);
      } else {
        await setTalentShortlist(target.candidateId, jobId, true, note || undefined);
      }
      setResults((rows) =>
        rows.map((row) =>
          row.id !== target.candidateId
            ? row
            : target.applicationId
              ? { ...row, applicationStatus: 'SHORTLISTED' }
              : { ...row, talentShortlisted: true },
        ),
      );
      toast.success('Candidate shortlisted');
      setShortlistTarget(null);
    } catch (err) {
      const text = userFacingError(err, 'shortlist candidate');
      setShortlistError(text);
      toast.error(text);
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
                Ranked matches for your open roles. Shortlist candidates and schedule interviews.
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
              void runSearch(jobId, filters, 1);
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
                  if (next) void runSearch(next, filters, 1);
                }}
                disabled={loading}
                required
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.city ? ` · ${job.city}` : ''}
                    {job.status ? ` (${jobStatusLabel(job.status)})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="ep-cand__filters">
              <label className="ep-cand__field">
                <span>Name / keyword</span>
                <input
                  type="text"
                  value={filters.q}
                  onChange={(e) => patchFilters({ q: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <div className="ep-cand__field">
                <CitySelect
                  id="cand-city"
                  label="Location"
                  value={filters.city}
                  onChange={(city) => patchFilters({ city })}
                />
              </div>
              <label className="ep-cand__field">
                <span>Experience</span>
                <select value={filters.experience} onChange={(e) => patchFilters({ experience: e.target.value })}>
                  <option value="">Any experience</option>
                  {CANDIDATE_EXPERIENCE_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ep-cand__field">
                <SearchableCreatableSelect
                  id="cand-skill"
                  label={`Skills (${filters.skills.length}/${CANDIDATE_SEARCH_MAX_SKILLS})`}
                  value={skillDraft}
                  onChange={addSkill}
                  options={SKILL_FILTER_OPTIONS}
                  placeholder="Add a skill…"
                  allowCustom
                  emptyLimit={40}
                />
              </div>
              <label className="ep-cand__field">
                <span>Language</span>
                <select value={filters.language} onChange={(e) => patchFilters({ language: e.target.value })}>
                  <option value="">Any language</option>
                  {languageOptions.map((item) => (
                    <option key={item.value} value={item.label}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ep-cand__field">
                <span>Education</span>
                <select value={filters.education} onChange={(e) => patchFilters({ education: e.target.value })}>
                  {CANDIDATE_EDUCATION_FILTERS.map((item) => (
                    <option key={item.value} value={item.value === 'any' ? '' : item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ep-cand__field">
                <span>Availability</span>
                <select
                  value={filters.availability}
                  onChange={(e) => patchFilters({ availability: e.target.value })}
                >
                  <option value="">Any availability</option>
                  {CANDIDATE_AVAILABILITY_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ep-cand__field">
                <span>Sort by</span>
                <select
                  value={filters.sort}
                  onChange={(e) => {
                    const next = { ...filters, sort: e.target.value };
                    setFilters(next);
                    if (jobId && hasSearched) void runSearch(jobId, next, 1);
                  }}
                >
                  {CANDIDATE_SEARCH_SORTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filters.skills.length ? (
              <div className="ep-cand__skills" aria-label="Selected skills">
                {filters.skills.map((item) => (
                  <span key={item}>
                    {item}
                    <button
                      type="button"
                      onClick={() => removeSkill(item)}
                      aria-label={`Remove ${item}`}
                      className="-my-3 ml-1 inline-flex min-h-12 min-w-12 items-center justify-center font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {skillError ? (
              <p className="ep-cand__error" role="alert">
                {skillError}
              </p>
            ) : null}

            {error ? (
              <p className="ep-cand__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ep-cand__actions">
              <button type="button" className="ep-cand__clear" onClick={clearFilters}>
                Clear All
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
            {loading || searching ? <SkeletonList rows={3} label="Loading candidates…" /> : null}

            {!loading && jobsError ? (
              <ErrorState message="Something went wrong. We couldn't load candidates." onRetry={loadJobs} />
            ) : null}

            {!loading && !searching && loadFailed ? (
              <ErrorState
                message="Something went wrong. We couldn't load candidates."
                onRetry={() => void runSearch(jobId, filters, page)}
              />
            ) : null}

            {!loading && !searching && !jobsError && !hasSearched ? (
              <div className="ep-cand__empty-state">
                <EmployerEmptyCue cue="search" />
                <p>Select a job to see candidates</p>
                <span>Matched candidates load automatically for your roles.</span>
              </div>
            ) : null}

            {!loading && !searching && !loadFailed && hasSearched && (results?.length ?? 0) === 0 ? (
              <div className="ep-cand__empty-state" data-state="empty">
                <EmployerEmptyCue cue="search" />
                <p>No candidates found</p>
                <span>Try broader filters or another job posting.</span>
              </div>
            ) : null}

            {!loading && !searching && (results?.length ?? 0) > 0 ? (
              <>
                <div className="ep-cand__results-head">
                  <h2 className="ep-cand__results-title">Matched candidates</h2>
                  <p className="ep-cand__results-meta" data-testid="candidates-count">
                    {total} {total === 1 ? 'candidate' : 'candidates'} found
                    {unlockLimit > 0 && totalMatched > total ? ` · ${totalMatched} matched in total` : ''}
                  </p>
                </div>

                <ul className="ep-cand__list">
                  {results.map((row) => {
                    const isShortlisted = row.applicationStatus === 'SHORTLISTED' || Boolean(row.talentShortlisted);
                    const canShortlist = row.applicationId
                      ? ['APPLIED', 'UNDER_REVIEW', 'ON_HOLD'].includes(String(row.applicationStatus || 'APPLIED'))
                      : !row.talentShortlisted;
                    const shortlistBusy = busyId === `shortlist-${row.id}`;
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
                            <span
                              className={`ep-cand__score ep-ats-chip--${atsMatchBand(row.matchScore).toLowerCase()}`}
                              title={`${PROFILE_MATCH_LABEL} for the selected job`}
                              aria-label={`${PROFILE_MATCH_LABEL} ${row.matchScore} out of 100`}
                            >
                              <small className="block text-[10px] font-bold uppercase tracking-wide">
                                {PROFILE_MATCH_LABEL}
                              </small>
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
                            <span>Education</span>
                            <strong>{row.highestEducation?.trim() || 'Not provided'}</strong>
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
                              disabled={shortlistBusy}
                              onClick={() =>
                                setShortlistTarget({
                                  candidateId: row.id,
                                  applicationId: row.applicationId || null,
                                  name: candidateName(row),
                                })
                              }
                            >
                              {shortlistBusy ? '…' : 'Shortlist'}
                            </button>
                          ) : null}
                          {isShortlisted ? (
                            <span
                              className="ep-cand__btn ep-cand__btn--ghost"
                              data-testid="shortlisted-badge"
                              title={row.applicationId ? undefined : 'Saved to your private shortlist for this job'}
                            >
                              Shortlisted ✓
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {pageCount > 1 ? (
                  <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Candidate pages">
                    <button
                      type="button"
                      className="ep-cand__btn ep-cand__btn--ghost min-h-12"
                      disabled={page <= 1 || searching}
                      onClick={() => void runSearch(jobId, filters, page - 1)}
                    >
                      Previous
                    </button>
                    <span className="text-sm font-semibold text-[#3f4a57]">
                      Page {page} of {pageCount}
                    </span>
                    <button
                      type="button"
                      className="ep-cand__btn ep-cand__btn--ghost min-h-12"
                      disabled={page >= pageCount || searching}
                      onClick={() => void runSearch(jobId, filters, page + 1)}
                    >
                      Next
                    </button>
                  </nav>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      </div>

      <ShortlistConfirmModal
        open={Boolean(shortlistTarget)}
        candidateName={shortlistTarget?.name || 'Candidate'}
        jobTitle={selectedJob?.title}
        busy={Boolean(shortlistTarget && busyId === `shortlist-${shortlistTarget.candidateId}`)}
        error={shortlistError}
        onCancel={() => {
          setShortlistTarget(null);
          setShortlistError('');
        }}
        onConfirm={(note) => {
          if (!shortlistTarget) return;
          return shortlist(shortlistTarget, note);
        }}
      />
    </EmployerShellFallback>
  );
}
