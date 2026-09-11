'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { JobCard } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { JobLocationFields } from '@/components/marketplace/JobLocationFields';
import { JobSearchFilters } from '@/components/marketplace/JobSearchFilters';
import { JobsOlxFilters } from '@/components/marketplace/JobsOlxFilters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatJobType, formatSalary } from '@/lib/match';
import { searchJobs } from '@/lib/candidate-marketplace-api';
import { saveJob, unsaveJob } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import type { JobFilterChip, JobSearchFilterValues } from '@/features/jobs/job-search';

const INITIAL_FILTERS: JobSearchFilterValues = {
  q: '',
  state: '',
  city: '',
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: 'monthly',
  experience: '',
  jobType: '',
  skills: [],
};

function FilterIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 5a1 1 0 011-1h16a1 1 0 01.8 1.6L15 12.5V19a1 1 0 01-1.45.9l-3-1.5A1 1 0 0110 17.5v-5L3.2 5.6A1 1 0 013 5z" />
    </svg>
  );
}

function BackIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function BookmarkIcon({ filled, className = 'h-5 w-5' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function JobsSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<JobSearchFilterValues>({
    ...INITIAL_FILTERS,
    q: searchParams.get('q') || '',
    state: searchParams.get('state') || '',
    city: searchParams.get('city') || '',
  });
  const [activeFilter, setActiveFilter] = useState<JobFilterChip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [showDesktopSearch, setShowDesktopSearch] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [savingId, setSavingId] = useState('');

  function updateFilters(patch: Partial<JobSearchFilterValues>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleFilter(chip: JobFilterChip) {
    setActiveFilter((prev) => (prev === chip ? null : chip));
  }

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await searchJobs({
        q: filters.q,
        state: filters.state,
        city: filters.city,
        salaryMin:
          !filters.salaryMin || filters.salaryMin === '0' ? '' : filters.salaryMin,
        salaryMax:
          !filters.salaryMax ||
          filters.salaryMax === '200000' ||
          filters.salaryMax === '2400000'
            ? ''
            : filters.salaryMax,
        salaryPeriod: filters.salaryPeriod,
        experience: filters.experience,
        jobType: filters.jobType,
        skills: filters.skills,
      });
      setJobs(result.items);
      setTotal(result.total || result.items.length);
      setHasSearched(true);
      setShowDesktopSearch(false);
      setMobileFilterOpen(false);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('q') || searchParams.get('state') || searchParams.get('city')) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFilters() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setShowDesktopSearch(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setMobileFilterOpen(true);
  }

  async function toggleSaveJob(event: React.MouseEvent, job: JobCard) {
    event.preventDefault();
    event.stopPropagation();
    if (!getStoredUser()) {
      router.push('/login');
      return;
    }
    setSavingId(job.id);
    try {
      if (job.saved) {
        await unsaveJob(job.id);
        setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, saved: false } : item)));
      } else {
        await saveJob(job.id);
        setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, saved: true } : item)));
      }
    } catch {
      // keep current state
    } finally {
      setSavingId('');
    }
  }

  const showSearchForm = !hasSearched || showDesktopSearch;
  const showResults = hasSearched;
  const showDesktopFilterButton = showResults && !showDesktopSearch;

  const desktopSearchForm = (
    <form
      onSubmit={(event) => void load(event)}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <Input
        label="Job title / skill"
        name="q"
        value={filters.q}
        onChange={(event) => updateFilters({ q: event.target.value })}
        placeholder="e.g. Sales, React, Fresher"
      />

      <JobLocationFields
        state={filters.state}
        city={filters.city}
        onStateChange={(state) => updateFilters({ state, city: '' })}
        onCityChange={(city) => updateFilters({ city })}
      />

      <JobSearchFilters
        activeFilter={activeFilter}
        onToggleFilter={toggleFilter}
        filters={filters}
        onChange={updateFilters}
      />

      <Button type="submit" loading={loading} loadingLabel="Searching..." className="w-full">
        Search
      </Button>
    </form>
  );

  return (
    <CandidateAppShell
      activeTab="jobs"
      maxWidth="max-w-3xl"
      mobileJobsFilterMode={hasSearched}
      onMobileJobsFilter={openFilters}
    >
      <div className="mx-auto w-full max-w-2xl space-y-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Find Jobs</h1>
        </div>

        {/* Previous form style: desktop always when open; mobile only before first search */}
        {showSearchForm ? (
          <div className={hasSearched ? 'hidden md:block' : 'block'}>{desktopSearchForm}</div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {showResults ? (
          <>
            {showDesktopFilterButton ? (
              <div className="hidden md:flex md:items-center">
                <button
                  type="button"
                  onClick={openFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#0a2e2c] shadow-sm hover:bg-slate-50"
                >
                  <FilterIcon className="h-4 w-4 shrink-0" />
                  <span>Filter</span>
                </button>
              </div>
            ) : null}

            <p className="text-sm font-bold text-slate-700">
              {loading ? 'Searching…' : `${total || jobs.length} jobs found`}
            </p>

            <div className="space-y-3">
              {!loading && !jobs.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No published employer jobs match these filters. Adjust filters and search again.
                </p>
              ) : null}
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="relative rounded-2xl border border-slate-200 bg-white p-4 pr-12 shadow-sm"
                >
                  <button
                    type="button"
                    disabled={savingId === job.id}
                    onClick={(event) => void toggleSaveJob(event, job)}
                    className={`absolute right-3 top-3 rounded-full p-2 transition disabled:opacity-60 ${
                      job.saved
                        ? 'bg-[#0a2e2c]/10 text-[#0a2e2c]'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-[#0a2e2c]'
                    }`}
                    aria-label={job.saved ? 'Unsave job' : 'Save job'}
                    title={job.saved ? 'Saved' : 'Save'}
                  >
                    <BookmarkIcon filled={Boolean(job.saved)} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2 pr-1">
                      <h2 className="text-base font-extrabold text-slate-900">{job.title}</h2>
                      {job.match ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          {job.match.score}% match
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{job.companyName}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {job.city} · {formatSalary(job.salaryMin, job.salaryMax)} ·{' '}
                      {formatJobType(job.jobType)}
                    </p>
                    <div className="mt-4">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-[#0a2e2c] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0d3d3a]"
                      >
                        Get Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {!hasSearched && !loading ? (
          <p className="text-center text-sm text-slate-500">
            Fill in your search details above, then tap Search to see matching jobs.
          </p>
        ) : null}
      </div>

      {/* Phone only: OLX filter screen from bottom Filter tab */}
      {mobileFilterOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="rounded-full p-2 text-slate-800 hover:bg-slate-50"
              aria-label="Back"
            >
              <BackIcon />
            </button>
            <h2 className="text-base font-extrabold text-slate-900">Filters</h2>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 pb-28">
            <JobsOlxFilters filters={filters} onChange={updateFilters} />
          </div>

          <div className="absolute inset-x-0 bottom-0 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              loading={loading}
              loadingLabel="Searching..."
              className="w-full !rounded-xl"
              onClick={() => void load()}
            >
              View Jobs
            </Button>
          </div>
        </div>
      ) : null}
    </CandidateAppShell>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <CandidateAppShell activeTab="jobs">
          <p className="p-8 text-sm text-slate-500">Loading jobs...</p>
        </CandidateAppShell>
      }
    >
      <JobsSearchContent />
    </Suspense>
  );
}
