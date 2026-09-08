'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { JobCard } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { JobLocationFields } from '@/components/marketplace/JobLocationFields';
import { JobSearchFilters } from '@/components/marketplace/JobSearchFilters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatJobType, formatSalary } from '@/lib/match';
import { searchJobs } from '@/lib/candidate-marketplace-api';
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

function JobsSearchContent() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<JobSearchFilterValues>({
    ...INITIAL_FILTERS,
    q: searchParams.get('q') || '',
    state: searchParams.get('state') || '',
    city: searchParams.get('city') || '',
  });
  const [activeFilters, setActiveFilters] = useState<JobFilterChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');

  function updateFilters(patch: Partial<JobSearchFilterValues>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLocationError('');
    setLoading(true);
    setError('');
    try {
      const result = await searchJobs({
        q: filters.q,
        state: filters.state,
        city: filters.city,
        salaryMin: filters.salaryMin,
        salaryMax: filters.salaryMax,
        salaryPeriod: filters.salaryPeriod,
        experience: filters.experience,
        jobType: filters.jobType,
        skills: filters.skills,
      });
      setJobs(result.items);
      setTotal(result.total || result.items.length);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFilter(chip: JobFilterChip) {
    setActiveFilters((prev) =>
      prev.includes(chip) ? prev.filter((item) => item !== chip) : [...prev, chip],
    );
  }

  return (
    <CandidateAppShell activeTab="jobs" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Find Jobs</h1>
          <Link href="/jobs/saved" className="text-sm font-bold text-[#0a2e2c] hover:underline">
            Saved jobs
          </Link>
        </div>

        <form onSubmit={load} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
          {locationError ? <p className="text-sm text-red-600">{locationError}</p> : null}

          <JobSearchFilters
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            filters={filters}
            onChange={updateFilters}
          />

          <Button type="submit" loading={loading} loadingLabel="Searching..." className="w-full">
            Search
          </Button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <p className="text-sm font-bold text-slate-700">
          {loading ? 'Searching…' : `${total || jobs.length} jobs found`}
        </p>

        <div className="flex gap-3 text-xs font-bold">
          <Link href="/jobs/saved" className="text-[#0a2e2c] hover:underline">
            View saved jobs →
          </Link>
        </div>

        <div className="space-y-3">
          {!loading && !jobs.length ? (
            <p className="text-sm text-slate-500">
              No published employer jobs match these filters. Clear filters or check back after employers post openings.
            </p>
          ) : null}
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0a2e2c]/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-slate-900">{job.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{job.companyName}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {job.city} · {formatSalary(job.salaryMin, job.salaryMax)} · {formatJobType(job.jobType)}
                  </p>
                </div>
                {job.match ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    {job.match.score}% match
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
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
