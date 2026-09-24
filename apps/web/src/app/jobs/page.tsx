'use client';

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { Lora } from 'next/font/google';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  NEARBY_DISTANCE_BUCKETS,
  type JobCard,
} from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { JobLocationFields } from '@/components/marketplace/JobLocationFields';
import { JobSearchFilters } from '@/components/marketplace/JobSearchFilters';
import { JobsOlxFilters } from '@/components/marketplace/JobsOlxFilters';
import { Button } from '@/components/ui/Button';
import { CitySelect } from '@/components/ui/CitySelect';
import { Input } from '@/components/ui/Input';
import { formatJobType } from '@/lib/match';
import { searchNearbyJobs } from '@/lib/candidate-marketplace-api';
import { saveJob, unsaveJob } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import type { JobFilterChip, JobSearchFilterValues } from '@/features/jobs/job-search';
import {
  advanceCursorFromResponse,
  initialNearbyCursor,
  labelForBucket,
  nearbyBucketKey,
  requestKey,
  type NearbyCursor,
  type NearbyFeedSection,
} from '@/features/jobs/nearby-buckets';
import {
  nearestCityName,
  originFromCity,
  readStoredSearchOrigin,
  requestBrowserLocation,
  storeSearchOrigin,
  type JobsSearchOrigin,
} from '@/lib/jobs-location';

const lora = Lora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-lora-jobs',
  display: 'swap',
});

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

const POPULAR_CITIES = [
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Gurgaon', state: 'Haryana' },
] as const;

function FilterIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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

function formatPosted(iso?: string | null) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${Math.floor(days / 30)} mo ago`;
}

/** Display monthly salary as compact LPA-style figures (matches Jobs Near You card UI). */
function formatSalaryCompact(min?: number | null, max?: number | null) {
  if (!min && !max) return null;
  const toFig = (n: number) => {
    const v = n / 100_000;
    return v >= 10 ? v.toFixed(1) : v.toFixed(2);
  };
  if (min && max) {
    return {
      main: `₹${toFig(min)} – ${toFig(max)}`,
      suffix: 'LPA',
    };
  }
  if (min) return { main: `From ₹${toFig(min)}`, suffix: 'LPA' };
  return { main: `Up to ₹${toFig(max!)}`, suffix: 'LPA' };
}

function ChangeIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PinIcon({ className = '', stroke = 'currentColor' }: { className?: string; stroke?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function filterSignature(filters: JobSearchFilterValues) {
  return [
    filters.q,
    filters.state,
    filters.city,
    filters.salaryMin,
    filters.salaryMax,
    filters.salaryPeriod,
    filters.experience,
    filters.jobType,
    filters.skills.join('|'),
  ].join('~');
}

function JobsSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<JobSearchFilterValues>({
    ...INITIAL_FILTERS,
    q: searchParams.get('q') || '',
    state: searchParams.get('state') || '',
    city: searchParams.get('city') || '',
  });
  const [activeFilter, setActiveFilter] = useState<JobFilterChip | null>(null);
  const [showDesktopSearch, setShowDesktopSearch] = useState(true);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [pickerCity, setPickerCity] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [savingId, setSavingId] = useState('');

  const [origin, setOrigin] = useState<JobsSearchOrigin | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'ready' | 'denied'>('idle');
  const [sections, setSections] = useState<NearbyFeedSection[]>([]);
  const [cursor, setCursor] = useState<NearbyCursor>(initialNearbyCursor());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedGeneration, setFeedGeneration] = useState(0);

  const loadingRef = useRef(false);
  const inFlightKey = useRef<string | null>(null);
  const seenJobIds = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef(cursor);
  const originRef = useRef(origin);
  const filtersRef = useRef(filters);
  const sectionsRef = useRef(sections);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    originRef.current = origin;
  }, [origin]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  function updateFilters(patch: Partial<JobSearchFilterValues>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleFilter(chip: JobFilterChip) {
    setActiveFilter((prev) => (prev === chip ? null : chip));
  }

  function resetFeed(nextOrigin: JobsSearchOrigin) {
    seenJobIds.current = new Set();
    inFlightKey.current = null;
    loadingRef.current = false;
    setSections([]);
    setCursor(initialNearbyCursor());
    setOrigin(nextOrigin);
    storeSearchOrigin(nextOrigin);
    setLocStatus('ready');
    setError('');
    setFeedGeneration((g) => g + 1);
  }

  async function tryUseGps() {
    setLocStatus('asking');
    setError('');
    try {
      const hint =
        filters.city.trim() ||
        (typeof window !== 'undefined'
          ? (getStoredUser() as { city?: string; preferredWorkCity?: string } | null)?.city ||
            (getStoredUser() as { preferredWorkCity?: string } | null)?.preferredWorkCity ||
            ''
          : '');
      const next = await requestBrowserLocation(10000, hint || null);
      resetFeed(next);
    } catch {
      setLocStatus('denied');
      const preferred =
        filters.city.trim() ||
        (typeof window !== 'undefined'
          ? (getStoredUser() as { city?: string } | null)?.city || ''
          : '');
      const fromCity = preferred ? originFromCity(preferred, 'preferred') : null;
      if (fromCity) {
        resetFeed(fromCity);
      }
    }
  }

  function usePreferredCity() {
    const city = filters.city.trim();
    const fromCity = city ? originFromCity(city, 'preferred') : null;
    if (!fromCity) {
      setError('Pick a city in filters (or allow location) to see jobs near you.');
      setLocStatus('denied');
      return;
    }
    resetFeed({ ...fromCity, source: 'manual' });
    setShowDesktopSearch(false);
  }

  useEffect(() => {
    const stored = readStoredSearchOrigin();
    if (stored) {
      if (stored.source === 'gps' && (stored.label === 'Current location' || !stored.label.includes('·'))) {
        const hint =
          filters.city.trim() ||
          (getStoredUser() as { city?: string } | null)?.city ||
          '';
        const nearest = nearestCityName(stored.latitude, stored.longitude);
        const cityName = hint || nearest;
        if (cityName && cityName !== stored.label) {
          resetFeed({ ...stored, label: cityName });
          return;
        }
      }
      resetFeed(stored);
      return;
    }
    void tryUseGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextPage = useCallback(async () => {
    const currentOrigin = originRef.current;
    const currentCursor = cursorRef.current;
    if (!currentOrigin || currentCursor.ended || loadingRef.current) return;

    const f = filtersRef.current;
    const sig = filterSignature(f);
    const remoteOnly = currentCursor.remotePhase === 'pending' || currentCursor.remotePhase === 'loading';
    const bucket = remoteOnly
      ? { minKm: 0, maxKm: 0 }
      : NEARBY_DISTANCE_BUCKETS[currentCursor.bucketIndex];
    if (!bucket && !remoteOnly) {
      setCursor((c) => ({ ...c, ended: true }));
      return;
    }

    const key = requestKey(
      currentOrigin.latitude,
      currentOrigin.longitude,
      bucket,
      currentCursor.page,
      sig,
      remoteOnly,
    );
    if (inFlightKey.current === key) return;
    inFlightKey.current = key;
    loadingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await searchNearbyJobs({
        latitude: currentOrigin.latitude,
        longitude: currentOrigin.longitude,
        minDistanceKm: remoteOnly ? 0 : bucket.minKm,
        maxDistanceKm: remoteOnly ? 10 : bucket.maxKm,
        page: currentCursor.page,
        limit: 20,
        remoteOnly: remoteOnly || undefined,
        q: f.q,
        experience: f.experience,
        jobType: f.jobType,
        skills: f.skills,
        salaryMin: f.salaryMin,
        salaryMax: f.salaryMax,
        salaryPeriod: f.salaryPeriod,
      });

      // Stale response guard
      if (originRef.current !== currentOrigin) return;

      const fresh = res.items.filter((job) => {
        if (seenJobIds.current.has(job.id)) return false;
        seenJobIds.current.add(job.id);
        return true;
      });

      if (fresh.length > 0) {
        const sectionKey = nearbyBucketKey(res.distanceBucket, res.remoteOnly);
        const label = labelForBucket(res.distanceBucket, res.remoteOnly);
        setSections((prev) => {
          const existing = prev.find((s) => s.key === sectionKey);
          if (existing) {
            return prev.map((s) =>
              s.key === sectionKey ? { ...s, jobs: [...s.jobs, ...fresh] } : s,
            );
          }
          return [
            ...prev,
            {
              key: sectionKey,
              label,
              remoteOnly: Boolean(res.remoteOnly),
              minKm: res.distanceBucket.minKm,
              maxKm: res.distanceBucket.maxKm,
              jobs: fresh,
            },
          ];
        });
      }

      // Empty remote → skip to distance buckets without showing empty section
      if (res.remoteOnly && res.totalInBucket === 0 && !res.hasMoreInBucket) {
        setCursor({
          bucketIndex: 0,
          page: 1,
          remotePhase: 'done',
          ended: false,
        });
        // Continue into first distance bucket in same tick after state settles
        queueMicrotask(() => {
          loadingRef.current = false;
          inFlightKey.current = null;
          void loadNextPage();
        });
        return;
      }

      // Empty distance bucket → jump to next bucket (no empty header) and continue
      if (!res.remoteOnly && fresh.length === 0 && !res.hasMoreInBucket) {
        const next = advanceCursorFromResponse(currentCursor, res);
        setCursor(next);
        if (!next.ended) {
          queueMicrotask(() => {
            loadingRef.current = false;
            inFlightKey.current = null;
            void loadNextPage();
          });
        }
        return;
      }

      setCursor(advanceCursorFromResponse(currentCursor, res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load nearby jobs.');
    } finally {
      loadingRef.current = false;
      inFlightKey.current = null;
      setLoading(false);
    }
  }, []);

  // Start / restart feed when location or filters generation changes
  useEffect(() => {
    if (locStatus !== 'ready' || !origin) return;
    void loadNextPage();
  }, [feedGeneration, locStatus, origin, loadNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadNextPage();
        }
      },
      { rootMargin: '240px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadNextPage, sections.length, cursor.ended]);

  function applyFiltersAndReload(event?: FormEvent) {
    event?.preventDefault();
    if (filters.city.trim()) {
      const fromCity = originFromCity(filters.city.trim(), 'manual');
      if (fromCity) {
        resetFeed(fromCity);
        setShowDesktopSearch(false);
        setMobileFilterOpen(false);
        return;
      }
    }
    if (!origin) {
      void tryUseGps();
      setShowDesktopSearch(false);
      setMobileFilterOpen(false);
      return;
    }
    // Keep origin; reset buckets with new filters
    seenJobIds.current = new Set();
    inFlightKey.current = null;
    setSections([]);
    setCursor(initialNearbyCursor());
    setFeedGeneration((g) => g + 1);
    setShowDesktopSearch(false);
    setMobileFilterOpen(false);
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
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            jobs: s.jobs.map((item) => (item.id === job.id ? { ...item, saved: false } : item)),
          })),
        );
      } else {
        await saveJob(job.id);
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            jobs: s.jobs.map((item) => (item.id === job.id ? { ...item, saved: true } : item)),
          })),
        );
      }
    } catch {
      // keep current state
    } finally {
      setSavingId('');
    }
  }

  const showSearchForm = showDesktopSearch || locStatus === 'denied';
  const totalShown = sections.reduce((n, s) => n + s.jobs.length, 0);

  const desktopSearchForm = (
    <form
      onSubmit={(event) => applyFiltersAndReload(event)}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <Input
        label="Job title / skill"
        name="q"
        value={filters.q}
        onChange={(event) => updateFilters({ q: event.target.value })}
        placeholder="e.g. Sales, React, Fresher"
      />

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Popular cities</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_CITIES.map((item) => {
            const active = filters.city === item.city;
            return (
              <button
                key={item.city}
                type="button"
                onClick={() => updateFilters({ city: item.city, state: item.state })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'border-[var(--jobs-dark)] bg-[var(--jobs-dark)] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <PinIcon stroke={active ? '#fff' : '#7d857f'} className="shrink-0" />
                {item.city}
              </button>
            );
          })}
        </div>
      </div>

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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={loading} loadingLabel="Searching..." className="w-full">
          {origin ? 'Apply filters' : 'Search near city'}
        </Button>
        {locStatus === 'denied' ? (
          <Button type="button" variant="secondary" className="w-full" onClick={() => void tryUseGps()}>
            Allow location
          </Button>
        ) : null}
      </div>
    </form>
  );

  return (
    <CandidateAppShell
      activeTab="jobs"
      maxWidth="max-w-none"
      mobileJobsFilterMode={Boolean(origin)}
      onMobileJobsFilter={() => setMobileFilterOpen(true)}
    >
      <div
        className={`${lora.variable} mx-auto w-full max-w-[400px] space-y-4 pb-4 md:max-w-none md:w-1/2 [--jobs-dark:#0c2822] [--jobs-dark-2:#123a32] [--jobs-hair:#e7e9e0] [--jobs-ink:#16211d] [--jobs-ink-soft:#4a534d] [--jobs-muted:#7d857f] [--jobs-good:#2f6b4f] [--jobs-good-soft:#dcece1]`}
        style={{ fontFamily: "Inter, system-ui, sans-serif", color: 'var(--jobs-ink)' }}
      >
        <h1
          className="text-[22px] font-bold leading-tight"
          style={{ fontFamily: 'var(--font-lora-jobs), Lora, serif' }}
        >
          Jobs Near You
        </h1>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f4ec] px-4 py-[13px]">
          {locStatus === 'asking' ? (
            <>
              <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-[var(--jobs-ink-soft)]">
                Allow location access to see jobs near you.
              </p>
              <button
                type="button"
                onClick={() => void tryUseGps()}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--jobs-dark)] px-3.5 py-2 text-xs font-bold text-white shadow-sm"
              >
                <PinIcon stroke="#fff" className="h-4 w-4" />
                Grant location
              </button>
            </>
          ) : null}
          {locStatus === 'denied' && !origin ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-[13.5px] font-semibold">Location access is unavailable.</p>
                <p className="text-[13px] text-[var(--jobs-muted)]">Use your preferred city or grant location.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={usePreferredCity}
                  className="rounded-full border border-[var(--jobs-hair)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--jobs-ink)]"
                >
                  Use preferred location
                </button>
                <button
                  type="button"
                  onClick={() => void tryUseGps()}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--jobs-dark)] px-3.5 py-2 text-xs font-bold text-white"
                >
                  <PinIcon stroke="#fff" className="h-4 w-4" />
                  Grant location
                </button>
              </div>
            </div>
          ) : null}
          {origin ? (
            <>
              <div className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold">
                <PinIcon stroke="#0c2822" className="shrink-0" />
                <span className="truncate">
                  {origin.source === 'gps'
                    ? origin.label === 'Current location'
                      ? 'Current location'
                      : `${origin.label.replace(/\s*·\s*Current location$/i, '')} · Current location`
                    : origin.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickerCity(filters.city || origin?.label?.split('·')[0]?.trim() || '');
                  setLocationPickerOpen(true);
                  setShowDesktopSearch(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--jobs-dark)] transition hover:opacity-65"
              >
                Change
                <ChangeIcon />
              </button>
            </>
          ) : null}
        </div>

        {showSearchForm ? (
          <div className={origin && !showDesktopSearch ? 'hidden md:block' : 'block'}>
            {desktopSearchForm}
          </div>
        ) : null}

        {origin && !showDesktopSearch ? (
          <div className="hidden md:flex md:items-center">
            <button
              type="button"
              onClick={() => setShowDesktopSearch(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--jobs-hair)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--jobs-dark)] shadow-sm hover:bg-[#f8f8f4]"
            >
              <FilterIcon className="h-4 w-4 shrink-0" />
              <span>Filter</span>
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {locationPickerOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Change location"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-[var(--jobs-dark)]">Choose location</h2>
                <button
                  type="button"
                  className="text-sm font-bold text-[var(--jobs-muted)]"
                  onClick={() => setLocationPickerOpen(false)}
                >
                  Close
                </button>
              </div>
              <CitySelect
                label="Search city"
                value={pickerCity}
                onChange={setPickerCity}
                required
              />
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Popular</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR_CITIES.map((item) => (
                  <button
                    key={item.city}
                    type="button"
                    onClick={() => setPickerCity(item.city)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      pickerCity === item.city
                        ? 'border-[var(--jobs-dark)] bg-[var(--jobs-dark)] text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {item.city}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!pickerCity.trim()}
                  onClick={() => {
                    const city = pickerCity.trim();
                    const match = POPULAR_CITIES.find((c) => c.city === city);
                    updateFilters({ city, state: match?.state || filters.state });
                    const next = originFromCity(city, 'manual');
                    if (next) resetFeed(next);
                    setLocationPickerOpen(false);
                    setShowDesktopSearch(false);
                  }}
                >
                  Use this city
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setLocationPickerOpen(false);
                    void tryUseGps();
                  }}
                >
                  Use GPS
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {origin ? (
          <div className="space-y-5">
            {sections.map((section, index) => (
              <section key={section.key} className="space-y-3">
                {index > 0 ? <div className="cb-jobs-bucket-divider" aria-hidden /> : null}
                <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--jobs-ink-soft)]">
                  {section.label}
                </h2>
                <div className="space-y-3">
                  {section.jobs.map((job) => {
                    const salary = formatSalaryCompact(job.salaryMin, job.salaryMax);
                    return (
                      <div
                        key={job.id}
                        className="relative rounded-[14px] border border-[var(--jobs-hair)] bg-white p-[18px]"
                      >
                        <button
                          type="button"
                          disabled={savingId === job.id}
                          onClick={(event) => void toggleSaveJob(event, job)}
                          className={`absolute right-3 top-3 rounded-full p-1.5 transition disabled:opacity-60 ${
                            job.saved
                              ? 'text-[var(--jobs-dark)]'
                              : 'text-[var(--jobs-muted)] hover:text-[var(--jobs-dark)]'
                          }`}
                          aria-label={job.saved ? 'Unsave job' : 'Save job'}
                        >
                          <BookmarkIcon filled={Boolean(job.saved)} className="h-[18px] w-[18px]" />
                        </button>

                        <div className="flex gap-3.5 pr-8 md:gap-5 md:pr-10">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h3
                                className="m-0 min-w-0 flex-1 text-[16.5px] font-bold leading-snug md:text-[18px]"
                                style={{ fontFamily: 'var(--font-lora-jobs), Lora, serif' }}
                              >
                                {job.title}
                              </h3>
                              {job.match ? (
                                <span className="inline-block shrink-0 whitespace-nowrap rounded-full bg-[var(--jobs-good-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--jobs-good)]">
                                  {job.match.score}% match
                                </span>
                              ) : null}
                            </div>
                            <p className="mb-0 mt-2 text-[13px] text-[var(--jobs-muted)] md:text-[14px]">
                              {job.companyName}
                            </p>
                            {(job.city || typeof job.distanceKm === 'number') && (
                              <p className="mb-0 mt-1.5 text-[13px] text-[var(--jobs-ink-soft)] md:text-[14px]">
                                {job.city || 'Nearby'}
                                {typeof job.distanceKm === 'number' ? (
                                  <span className="font-bold text-[var(--jobs-ink)]">
                                    {' '}
                                    · {job.distanceKm.toFixed(1)} km away
                                  </span>
                                ) : null}
                              </p>
                            )}
                            <p className="mb-0 mt-1.5 text-[13px] text-[var(--jobs-muted)] md:text-[13.5px]">
                              {[
                                salary
                                  ? `${salary.main} ${salary.suffix}`
                                  : null,
                                job.experience,
                                job.workMode || formatJobType(job.jobType),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {formatPosted(job.publishedAt) ? (
                              <p className="mb-0 mt-1 text-[11px] font-medium text-[var(--jobs-muted)] md:text-xs">
                                {formatPosted(job.publishedAt)}
                              </p>
                            ) : null}
                          </div>

                          {typeof job.distanceKm === 'number' ? (
                            <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                              <div className="w-[1.5px] self-stretch bg-[var(--jobs-hair)]" />
                              <div className="flex flex-col items-center gap-1 pl-0.5">
                                <PinIcon stroke="#7d857f" />
                                <span className="whitespace-nowrap text-[12.5px] font-bold text-[var(--jobs-ink-soft)]">
                                  {job.distanceKm.toFixed(1)} km
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="flex-1 rounded-[10px] border border-[var(--jobs-dark)] bg-white py-3 text-center text-sm font-bold text-[var(--jobs-dark)] transition hover:bg-[#f4f7f6]"
                          >
                            View
                          </Link>
                          {job.applied ? (
                            <button
                              type="button"
                              disabled
                              className="flex-1 cursor-not-allowed rounded-[10px] border border-[var(--jobs-hair)] bg-[#eef2f1] py-3 text-center text-sm font-bold text-[var(--jobs-muted)]"
                            >
                              Applied
                            </button>
                          ) : (
                            <Link
                              href={`/jobs/${job.id}/apply`}
                              className="flex-1 rounded-[10px] bg-[var(--jobs-dark)] py-3 text-center text-sm font-bold text-white transition hover:-translate-y-px hover:bg-[var(--jobs-dark-2)] hover:shadow-[0_8px_18px_rgba(12,40,34,.25)]"
                            >
                              Apply
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {!loading && totalShown === 0 && locStatus === 'ready' ? (
              <p className="rounded-[14px] border border-dashed border-[var(--jobs-hair)] bg-white p-5 text-sm text-[var(--jobs-muted)]">
                Currently no match found with your profile. We will notify you when a suitable role
                opens up near this location.
              </p>
            ) : null}

            {loading ? (
              <p className="text-sm font-semibold text-[var(--jobs-ink-soft)]">Loading nearby jobs…</p>
            ) : null}

            {cursor.ended ? (
              <p className="rounded-full border border-[var(--jobs-hair)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--jobs-ink-soft)]">
                You&apos;ve reached the end of jobs within 50 km.
              </p>
            ) : (
              <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
            )}
          </div>
        ) : null}
      </div>

      {mobileFilterOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
              aria-label="Close filters"
            >
              <BackIcon />
            </button>
            <h2 className="text-lg font-extrabold text-slate-900">Filters</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <JobsOlxFilters
              filters={filters}
              onChange={updateFilters}
              onViewJobs={() => applyFiltersAndReload()}
              loading={loading}
            />
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
        <CandidateAppShell activeTab="jobs" maxWidth="max-w-none">
          <p className="text-sm text-slate-500">Loading jobs…</p>
        </CandidateAppShell>
      }
    >
      <JobsSearchContent />
    </Suspense>
  );
}
