'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { JobCard } from '@careerbridge/shared';
import { listJobs } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { JobListingCard } from '@/components/JobListingCard';
import { Input } from '@/components/ui/Input';
import { CitySelect } from '@/components/ui/CitySelect';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Button } from '@/components/ui/Button';

function JobsSearch() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await listJobs({ q, location, category });
      setJobs(result.items);
    } catch {
      setError('Something went wrong. Your information is safe. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Initial load uses the query from the URL search bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CandidateShell>
      <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Find your next opportunity</h1>
      <p className="mt-2 text-muted">We show relevant jobs first, not the longest list.</p>
      <form onSubmit={load} className="cb-dash-card relative z-10 mt-2 grid gap-3 overflow-visible p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Search" name="q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Customer service" />
        <CitySelect label="Location" allowAll value={location} onChange={setLocation} />
        <CategorySelect allowAll value={category} onChange={setCategory} />
        <div className="flex items-end">
          <Button type="submit" loading={loading} loadingLabel="Searching...">Search</Button>
        </div>
      </form>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!loading && !jobs.length ? <p className="text-muted md:col-span-2 xl:col-span-3">No jobs match these filters yet.</p> : null}
        {jobs.map((job) => (
          <JobListingCard key={job.id} job={job} />
        ))}
      </div>
    </CandidateShell>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<main className="cb-portal-page p-8 text-sm text-muted">Loading jobs...</main>}>
      <JobsSearch />
    </Suspense>
  );
}
