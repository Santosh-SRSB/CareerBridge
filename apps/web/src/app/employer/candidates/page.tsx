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
  atsMatchBandInfo,
} from '@careerbridge/shared';
import {
  getEmployerMe,
  listEmployerJobs,
  searchEmployerCandidates,
  changeApplicationStatus,
  setTalentShortlist,
} from '@/lib/api';
import {
  EmployerShellFallback,
  WAITING_FOR_ADMINISTRATION_APPROVAL,
  isEmployerAdminVerified,
} from '@/components/EmployerPortal';
import { ShortlistConfirmModal } from '@/components/employer/ShortlistConfirmModal';
import { EvAlert, EvAvatar, EvEmpty, EvPageHead, EvSkeleton } from '@/components/employer/ui';
import { CitySelect } from '@/components/ui/CitySelect';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';
import { ErrorState } from '@/components/ui/StateViews';
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

/** Short degree label for dense cards (keep full title as tooltip). */
function shortEducation(value: string) {
  const raw = value.trim();
  if (!raw || raw === 'Not provided') return raw || 'Not provided';
  // Prefer acronym / leading token before parentheses: "MCA (Master…)" → "MCA"
  const beforeParen = raw.split('(')[0]?.trim();
  const compact = beforeParen || raw;
  return compact.length > 18 ? `${compact.slice(0, 16)}…` : compact;
}

function shortSkillLabel(skill: string) {
  const raw = skill.trim();
  if (!raw) return '';
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren?.[1]) {
    const first = paren[1].split(/[,|/]/)[0]?.trim();
    if (first) return first.slice(0, 22);
  }
  return raw
    .replace(/^Frontend:\s*/i, '')
    .replace(/^Backend:\s*/i, '')
    .replace(/^DevOps(?:\s*&\s*CI\/CD)?:\s*/i, '')
    .replace(/^Tools?:\s*/i, '')
    .slice(0, 22);
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
  const [awaitingAdmin, setAwaitingAdmin] = useState(false);

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

  function loadJobs(initial: CandidateFilters = EMPTY_FILTERS) {
    setLoading(true);
    setJobsError(false);
    listEmployerJobs()
      .then(async (rows) => {
        setJobs(rows);
        const firstId = rows[0]?.id || '';
        if (firstId) {
          setJobId(firstId);
          await runSearch(firstId, initial);
        }
      })
      .catch(() => {
        setJobs([]);
        setJobsError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim().slice(0, 100);
    const initial = q ? { ...EMPTY_FILTERS, q } : EMPTY_FILTERS;
    if (q) setFilters(initial);
    setLoading(true);
    getEmployerMe()
      .then((profile) => {
        if (!isEmployerAdminVerified(profile.verificationStatus)) {
          setAwaitingAdmin(true);
          setLoading(false);
          return;
        }
        loadJobs(initial);
      })
      .catch(() => {
        setJobsError(true);
        setLoading(false);
      });
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

  if (awaitingAdmin) {
    return (
      <EmployerShellFallback title="Candidates">
        <EvPageHead eyebrow="Talent pool" title="Candidates" subtitle={WAITING_FOR_ADMINISTRATION_APPROVAL} />
        <div className="ev-card ev-mt">
          <EvEmpty
            title={WAITING_FOR_ADMINISTRATION_APPROVAL}
            body="CareerBridge must verify your company before you can view candidates and match rates."
          />
        </div>
      </EmployerShellFallback>
    );
  }

  return (
    <EmployerShellFallback title="Candidates">
      <EvPageHead
        eyebrow="Talent pool"
        title="Candidates"
        subtitle="Ranked matches for your open roles. Shortlist candidates and schedule interviews."
        actions={
          selectedJob ? (
            <div className="ev-card ev-matching">
              <small>Matching</small>
              <b>{selectedJob.title}</b>
            </div>
          ) : null
        }
      />

      <form
        className="ev-card ev-form ev-mt"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(jobId, filters, 1);
        }}
      >
        <label className="ev-field" style={{ margin: 0 }}>
          <span className="ev-flabel">Match against job</span>
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

        <div className="ev-f ev-filters">
          <label>
            Name / keyword
            <input
              type="text"
              value={filters.q}
              onChange={(e) => patchFilters({ q: e.target.value })}
              placeholder="Optional"
            />
          </label>
          <div>
            <CitySelect id="cand-city" label="Location" value={filters.city} onChange={(city) => patchFilters({ city })} />
          </div>
          <label>
            Experience
            <select value={filters.experience} onChange={(e) => patchFilters({ experience: e.target.value })}>
              <option value="">Any experience</option>
              {CANDIDATE_EXPERIENCE_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div>
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
          <label>
            Language
            <select value={filters.language} onChange={(e) => patchFilters({ language: e.target.value })}>
              <option value="">Any language</option>
              {languageOptions.map((item) => (
                <option key={item.value} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Education
            <select value={filters.education} onChange={(e) => patchFilters({ education: e.target.value })}>
              {CANDIDATE_EDUCATION_FILTERS.map((item) => (
                <option key={item.value} value={item.value === 'any' ? '' : item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select value={filters.availability} onChange={(e) => patchFilters({ availability: e.target.value })}>
              <option value="">Any availability</option>
              {CANDIDATE_AVAILABILITY_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
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
          <ul className="ev-chips2 ev-mt-sm" aria-label="Selected skills">
            {filters.skills.map((item) => (
              <li key={item} className="ev-sk">
                {item}
                <button type="button" onClick={() => removeSkill(item)} aria-label={`Remove ${item}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {skillError ? <p className="ev-error" role="alert">{skillError}</p> : null}

        {error ? (
          <div className="ev-mt-sm">
            <EvAlert tone="error">{error}</EvAlert>
          </div>
        ) : null}

        <div className="ev-form-actions">
          <button type="button" className="ev-lnk ev-lnk--mut" onClick={clearFilters}>
            Clear All
          </button>
          <button type="submit" className="ev-btn ev-btn--accent" disabled={!jobId || loading || searching}>
            {searching ? 'Searching…' : 'Search candidates'}
          </button>
        </div>
      </form>

      <section className="ev-mt" aria-live="polite">
        {loading || searching ? (
          <div className="ev-grid ev-g2" aria-busy="true">
            <span className="sr-only">Loading candidates…</span>
            <EvSkeleton height={260} />
            <EvSkeleton height={260} />
          </div>
        ) : null}

        {!loading && jobsError ? (
          <ErrorState message="Something went wrong. We couldn't load candidates." onRetry={() => loadJobs(filters)} />
        ) : null}

        {!loading && !searching && loadFailed ? (
          <ErrorState
            message="Something went wrong. We couldn't load candidates."
            onRetry={() => void runSearch(jobId, filters, page)}
          />
        ) : null}

        {!loading && !searching && !jobsError && !hasSearched ? (
          <div className="ev-card">
            <EvEmpty
              title="Select a job to see candidates"
              body="Matched candidates load automatically for your roles."
              action={
                jobs.length ? null : (
                  <Link href="/employer/jobs/new" className="ev-btn ev-btn--accent">
                    Post a job
                  </Link>
                )
              }
            />
          </div>
        ) : null}

        {!loading && !searching && !loadFailed && hasSearched && (results?.length ?? 0) === 0 ? (
          <div className="ev-card" data-state="empty">
            <EvEmpty title="No candidates found" body="Try broader filters or another job posting." />
          </div>
        ) : null}

        {!loading && !searching && (results?.length ?? 0) > 0 ? (
          <>
            <div className="ev-results-head">
              <h2>Matched candidates</h2>
              <span className="ev-sub" data-testid="candidates-count">
                <b>
                  {total} {total === 1 ? 'candidate' : 'candidates'} found
                </b>
                {unlockLimit > 0 && totalMatched > total ? ` · ${totalMatched} matched in total` : ''}
              </span>
            </div>

            <ul className="ev-cand-grid ev-plain-list">
              {results.map((row) => {
                const isShortlisted = row.applicationStatus === 'SHORTLISTED' || Boolean(row.talentShortlisted);
                const canShortlist = row.applicationId
                  ? ['APPLIED', 'UNDER_REVIEW', 'ON_HOLD'].includes(String(row.applicationStatus || 'APPLIED'))
                  : !row.talentShortlisted;
                const shortlistBusy = busyId === `shortlist-${row.id}`;
                const skillLabels = row.skills
                  .map(shortSkillLabel)
                  .filter(Boolean)
                  .filter((label, index, all) => all.findIndex((x) => x.toLowerCase() === label.toLowerCase()) === index);
                const visibleSkills = skillLabels.slice(0, 3);
                const moreSkills = Math.max((row.skillsTotal || row.skills.length) - visibleSkills.length, 0);
                const availabilityTone = row.availabilityTone || 'neutral';
                const band = row.matchScore !== null ? atsMatchBandInfo(row.matchScore) : null;
                const name = candidateName(row);
                const educationFull = row.highestEducation?.trim() || 'Not provided';
                const education = shortEducation(educationFull);
                const location = formatLocation(row.city, row.state);

                return (
                  <li key={row.id} className="ev-card ev-candcard">
                    <header className="ev-candcard__head">
                      <div className="ev-candcard__avatar">
                        <EvAvatar name={name} photoUrl={row.photoUrl} size="lg" />
                      </div>
                      <div className="ev-candcard__who">
                        <h3>{name}</h3>
                        <p className="ev-candcard__meta">
                          <span className="ev-candcard__loc">{location}</span>
                          {band ? (
                            <>
                              <span className="ev-candcard__dot" aria-hidden>
                                ·
                              </span>
                              <span className={`ev-candcard__band ev-candcard__band--${band.color}`}>
                                {band.shortLabel}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      {band && row.matchScore !== null ? (
                        <div
                          className="ev-candcard__match"
                          title={`${PROFILE_MATCH_LABEL} for the selected job · ${band.label}`}
                          aria-label={`${PROFILE_MATCH_LABEL} ${row.matchScore} out of 100`}
                        >
                          <span className="ev-candcard__score">{row.matchScore}</span>
                          <span className="ev-candcard__score-label">Match</span>
                        </div>
                      ) : null}
                    </header>

                    <div className="ev-candcard__stats" aria-label="Candidate summary">
                      <div>
                        <small>Experience</small>
                        <b>{formatExperience(row)}</b>
                      </div>
                      <div>
                        <small>Education</small>
                        <b className="ev-candcard__edu" title={educationFull}>
                          {education}
                        </b>
                      </div>
                      <div>
                        <small>Availability</small>
                        <b className={`ev-avail ev-avail--${availabilityTone}`}>
                          {row.availabilityLabel || 'Available'}
                        </b>
                      </div>
                    </div>

                    <div className="ev-candcard__skills">
                      {visibleSkills.length ? (
                        <div className="ev-chips" aria-label="Skills">
                          {visibleSkills.map((item) => (
                            <span key={item} className="ev-chip">
                              {item}
                            </span>
                          ))}
                          {moreSkills > 0 ? (
                            <span className="ev-chip ev-candcard__more">+{moreSkills}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="ev-sub">No skills listed</span>
                      )}
                    </div>

                    <footer className="ev-candcard__actions">
                      <Link
                        href={`/employer/candidates/${row.id}?jobId=${encodeURIComponent(jobId)}`}
                        className="ev-btn ev-btn--ghost ev-btn--sm ev-candcard__view"
                      >
                        View profile
                      </Link>
                      {canShortlist ? (
                        <button
                          type="button"
                          className="ev-btn ev-btn--sm ev-candcard__shortlist"
                          disabled={shortlistBusy}
                          onClick={() =>
                            setShortlistTarget({
                              candidateId: row.id,
                              applicationId: row.applicationId || null,
                              name,
                            })
                          }
                        >
                          {shortlistBusy ? '…' : 'Shortlist'}
                        </button>
                      ) : null}
                      {isShortlisted ? (
                        <span
                          className="ev-candcard__shortlisted"
                          data-testid="shortlisted-badge"
                          title={row.applicationId ? undefined : 'Saved to your private shortlist for this job'}
                        >
                          Shortlisted ✓
                        </span>
                      ) : null}
                    </footer>
                  </li>
                );
              })}
            </ul>

            {pageCount > 1 ? (
              <nav className="ev-pager" aria-label="Candidate pages">
                <button
                  type="button"
                  className="ev-btn ev-btn--ghost"
                  disabled={page <= 1 || searching}
                  onClick={() => void runSearch(jobId, filters, page - 1)}
                >
                  Previous
                </button>
                <span className="ev-sub">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  className="ev-btn ev-btn--ghost"
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
