'use client';

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  NEARBY_DISTANCE_BUCKETS,
  listCityCentroids,
  lookupCityCentroid,
  normalizeCityKey,
  type JobCard,
  type NearbyJobsResponse,
} from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { JobLocationFields } from '@/components/marketplace/JobLocationFields';
import { JobSearchFilters } from '@/components/marketplace/JobSearchFilters';
import { JobsOlxFilters } from '@/components/marketplace/JobsOlxFilters';
import { Button } from '@/components/ui/Button';
import { formatJobType } from '@/lib/match';
import { searchNearbyJobs } from '@/lib/candidate-marketplace-api';
import { saveJob, unsaveJob } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/StateViews';
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
  cityDisplayName,
  nearestCityName,
  originFromCity,
  readStoredSearchOrigins,
  requestBrowserLocation,
  storeSearchOrigins,
  type JobsSearchOrigin,
} from '@/lib/jobs-location';
import './candidate-jobs.css';

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

const MAX_LOCATIONS = 5;
const VISIBLE_CHIPS = 2;

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

const CITY_SUGGESTIONS = Array.from(
  new Set(listCityCentroids().map((city) => cityDisplayName(city.name))),
).sort();

const ICONS: Record<string, ReactNode> = {
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  brief: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </>
  ),
  build: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <path d="M16 13h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  filter: <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />,
  back: <path d="M15 19l-7-7 7-7" />,
  'city-bengaluru': <path d="M3 21h18M5 21V12h14v9M8 12v9M12 12v9M16 12v9M7 12a5 5 0 0 1 10 0M12 7V4M10.5 4h3" />,
  'city-hyderabad': (
    <path d="M3 21h18M5 21V8M19 21V8M3.5 8h3M17.5 8h3M5 8V5M19 8V5M5 12h14M9 21v-4a3 3 0 0 1 6 0v4M12 12V9M10 9h4" />
  ),
  'city-mumbai': (
    <path d="M3 21h18M6 21V9h12v12M9 21v-7a3 3 0 0 1 6 0v7M6 9V6M18 9V6M10 9V6M14 9V6M5 6h2M17 6h2M9 6h2M13 6h2" />
  ),
  'city-pune': <path d="M3 8h3V6h3v2h3V6h3v2h3V6h3M3 8v13M21 6v15M3 21h18M9 21v-6a3 3 0 0 1 6 0v6" />,
  'city-chennai': <path d="M3 21h18M5 21v-3h14v3M7 18v-3h10v3M9 15v-3h6v3M10.5 12V9.5h3V12M12 9.5V6M11 6h2" />,
  'city-delhi': <path d="M4 21h16M6 21V8h12v13M9 21v-8a3 3 0 0 1 6 0v8M4 8h16M8 8V5h8v3" />,
  'city-noida': <path d="M3 21h18M5 21V6h5v15M14 21V3h5v18M7 9h1M7 12h1M7 15h1M16 7h1M16 10h1M16 13h1M16 16h1" />,
  'city-gurgaon': <path d="M3 21h18M5 21v-9h4v9M9 21V5h5v16M14 21v-9h5v9M11 8h1M11 11h1M11 14h1M11 17h1" />,
};

function Icon({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <svg className={small ? 'jb-ic jb-ic--sm' : 'jb-ic'} viewBox="0 0 24 24" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

const LOGO_PALETTE = [
  ['#E6ECFF', '#1A1FC4'],
  ['#E3E5F6', '#0F7B4D'],
  ['#FFF1E0', '#B45309'],
  ['#F3E8FF', '#7E22CE'],
  ['#FFE8EC', '#BE123C'],
  ['#E0E3FA', '#0E1B90'],
] as const;

function companyLogo(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [background, color] = LOGO_PALETTE[hash % LOGO_PALETTE.length];
  const initials =
    name
      .replace(/[^A-Za-z ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'CO';
  return { background, color, initials };
}

function jobSkills(job: JobCard) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of [...(job.requiredSkills || []), ...(job.preferredSkills || [])]) {
    const key = skill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(skill.trim());
  }
  return out;
}

function formatWorkMode(mode: string) {
  const m = mode.trim().toUpperCase();
  if (m === 'ONSITE') return 'On-site';
  if (m === 'HYBRID') return 'Hybrid';
  if (m === 'REMOTE') return 'Remote';
  return mode;
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

/** Distance-bucket cursor for the location currently being paged. */
type FeedCursor = NearbyCursor & { originIndex: number };

function initialFeedCursor(): FeedCursor {
  return { ...initialNearbyCursor(), originIndex: 0 };
}

/** Next page within this location, then the next selected location (remote jobs load once). */
function advanceFeedCursor(cursor: FeedCursor, res: NearbyJobsResponse, originCount: number): FeedCursor {
  const next = advanceCursorFromResponse(cursor, res);
  if (next.ended && cursor.originIndex + 1 < originCount) {
    return { bucketIndex: 0, page: 1, remotePhase: 'done', ended: false, originIndex: cursor.originIndex + 1 };
  }
  return { ...next, originIndex: cursor.originIndex };
}

function originName(origin: JobsSearchOrigin) {
  const name = origin.label.replace(/\s*·\s*Current location$/i, '').trim();
  return name || 'Current location';
}

function sameOrigin(a: JobsSearchOrigin, b: JobsSearchOrigin) {
  return normalizeCityKey(originName(a)) === normalizeCityKey(originName(b));
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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [locInput, setLocInput] = useState('');
  const [locMessage, setLocMessage] = useState('');
  const [allLocationsOpen, setAllLocationsOpen] = useState(false);

  const [origins, setOrigins] = useState<JobsSearchOrigin[]>([]);
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'ready' | 'denied'>('idle');
  const [sections, setSections] = useState<NearbyFeedSection[]>([]);
  const [cursor, setCursor] = useState<FeedCursor>(initialFeedCursor());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedGeneration, setFeedGeneration] = useState(0);

  const loadingRef = useRef(false);
  const inFlightKey = useRef<string | null>(null);
  const seenJobIds = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const locCellRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const cursorRef = useRef(cursor);
  const originsRef = useRef(origins);
  const filtersRef = useRef(filters);
  const sectionsRef = useRef(sections);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    originsRef.current = origins;
  }, [origins]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  function updateFilters(patch: Partial<JobSearchFilterValues>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  const toggleFilter = useCallback((chip: JobFilterChip) => {
    setActiveFilter((prev) => (prev === chip ? null : chip));
  }, []);

  function resetFeed(nextOrigins: JobsSearchOrigin[]) {
    seenJobIds.current = new Set();
    inFlightKey.current = null;
    loadingRef.current = false;
    setSections([]);
    setCursor(initialFeedCursor());
    setOrigins(nextOrigins);
    storeSearchOrigins(nextOrigins);
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
      const others = originsRef.current.filter((o) => o.source !== 'gps' && !sameOrigin(o, next));
      resetFeed([next, ...others].slice(0, MAX_LOCATIONS));
    } catch {
      if (originsRef.current.length) {
        setLocStatus('ready');
        setLocMessage('Location access is unavailable. You can still search by city.');
        return;
      }
      setLocStatus('denied');
      const preferred =
        filters.city.trim() ||
        (typeof window !== 'undefined'
          ? (getStoredUser() as { city?: string } | null)?.city || ''
          : '');
      const fromCity = preferred ? originFromCity(preferred, 'preferred') : null;
      if (fromCity) {
        resetFeed([fromCity]);
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
    resetFeed([{ ...fromCity, source: 'manual' }]);
    setShowDesktopSearch(false);
  }

  useEffect(() => {
    const stored = readStoredSearchOrigins();
    if (stored.length) {
      const relabeled = stored.map((item) => {
        if (item.source !== 'gps' || (item.label !== 'Current location' && item.label.includes('·'))) {
          return item;
        }
        const hint =
          filters.city.trim() ||
          (getStoredUser() as { city?: string } | null)?.city ||
          '';
        const cityName = hint || nearestCityName(item.latitude, item.longitude);
        return cityName && cityName !== item.label ? { ...item, label: cityName } : item;
      });
      resetFeed(relabeled);
      return;
    }
    void tryUseGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextPage = useCallback(async () => {
    const currentOrigins = originsRef.current;
    const currentCursor = cursorRef.current;
    const currentOrigin = currentOrigins[currentCursor.originIndex];
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
      if (originsRef.current !== currentOrigins) return;

      const fresh = res.items.filter((job) => {
        if (seenJobIds.current.has(job.id)) return false;
        seenJobIds.current.add(job.id);
        return true;
      });

      if (fresh.length > 0) {
        const multi = currentOrigins.length > 1 && !res.remoteOnly;
        const bucketKey = nearbyBucketKey(res.distanceBucket, res.remoteOnly);
        const sectionKey = multi ? `${currentCursor.originIndex}:${bucketKey}` : bucketKey;
        const bucketLabel = labelForBucket(res.distanceBucket, res.remoteOnly);
        const label = multi ? `${originName(currentOrigin)} · ${bucketLabel}` : bucketLabel;
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
          originIndex: currentCursor.originIndex,
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
        const next = advanceFeedCursor(currentCursor, res, currentOrigins.length);
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

      setCursor(advanceFeedCursor(currentCursor, res, currentOrigins.length));
    } catch (err) {
      setError(userFacingError(err, 'load jobs'));
    } finally {
      loadingRef.current = false;
      inFlightKey.current = null;
      setLoading(false);
    }
  }, []);

  // Start / restart feed when location or filters generation changes
  useEffect(() => {
    if (locStatus !== 'ready' || !origins.length) return;
    void loadNextPage();
  }, [feedGeneration, locStatus, origins, loadNextPage]);

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

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFilterOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileFilterOpen]);

  useEffect(() => {
    if (!allLocationsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!locCellRef.current?.contains(event.target as Node)) setAllLocationsOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAllLocationsOpen(false);
      moreBtnRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [allLocationsOpen]);

  /** Resolves a typed city to a search origin, or explains why it can't be added. */
  function originForCity(raw: string, list: JobsSearchOrigin[]): JobsSearchOrigin | string {
    const name = raw.trim().replace(/\s+/g, ' ');
    const hit = name.length >= 3 ? lookupCityCentroid(name) : null;
    if (!hit) return `We couldn't find "${name}". Try a nearby larger city.`;
    const label =
      normalizeCityKey(name) === normalizeCityKey(hit.name) ? cityDisplayName(name) : cityDisplayName(hit.name);
    const next: JobsSearchOrigin = { latitude: hit.lat, longitude: hit.lng, label, source: 'manual' };
    if (list.some((o) => sameOrigin(o, next))) return `${label} is already added.`;
    if (list.length >= MAX_LOCATIONS) return `You can add up to ${MAX_LOCATIONS} locations.`;
    return next;
  }

  function addLocation(raw: string) {
    if (!raw.trim()) return false;
    const result = originForCity(raw, origins);
    if (typeof result === 'string') {
      setLocMessage(result);
      return false;
    }
    setLocMessage('');
    resetFeed([...origins, result]);
    return true;
  }

  function removeLocation(index: number) {
    const next = origins.filter((_, i) => i !== index);
    if (next.length <= VISIBLE_CHIPS) setAllLocationsOpen(false);
    setLocMessage('');
    resetFeed(next);
  }

  function togglePopularCity(city: string) {
    const index = origins.findIndex((o) => normalizeCityKey(originName(o)) === normalizeCityKey(city));
    if (index >= 0) {
      removeLocation(index);
      return;
    }
    addLocation(city);
  }

  function onLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === 'Enter' || event.key === ',') && locInput.trim()) {
      event.preventDefault();
      if (addLocation(locInput)) setLocInput('');
    } else if (event.key === 'Backspace' && !locInput && origins.length) {
      removeLocation(origins.length - 1);
    }
  }

  function onLocationChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const picked = (event.nativeEvent as InputEvent).inputType === 'insertReplacementText' || !('inputType' in event.nativeEvent);
    if (picked && CITY_SUGGESTIONS.includes(value) && addLocation(value)) {
      setLocInput('');
      return;
    }
    setLocInput(value);
    if (locMessage) setLocMessage('');
  }

  function clearFilters() {
    setFilters((prev) => ({ ...INITIAL_FILTERS, state: prev.state, city: prev.city }));
    filtersRef.current = { ...INITIAL_FILTERS, state: filters.state, city: filters.city };
    setActiveFilter(null);
    if (!origins.length) return;
    seenJobIds.current = new Set();
    inFlightKey.current = null;
    setSections([]);
    setCursor(initialFeedCursor());
    setFeedGeneration((g) => g + 1);
  }

  function retryLoad() {
    setError('');
    void loadNextPage();
  }

  function applyFiltersAndReload(event?: FormEvent) {
    event?.preventDefault();
    let next = origins;
    const pending = [locInput, filters.city].map((value) => value.trim()).filter(Boolean);
    for (const city of pending) {
      const result = originForCity(city, next);
      if (typeof result === 'string') {
        if (city === locInput.trim() || !result.endsWith('already added.')) setLocMessage(result);
        continue;
      }
      next = [...next, result];
    }
    if (locInput.trim() && next.length > origins.length) setLocInput('');
    if (!next.length) {
      if (!filters.state) {
        setLocMessage('Add a city, choose a state, or allow location access to search.');
        return;
      }
      void tryUseGps();
      setShowDesktopSearch(false);
      setMobileFilterOpen(false);
      return;
    }
    resetFeed(next);
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
  const hasActiveFilters = Boolean(
    filters.q.trim() ||
      filters.salaryMin.trim() ||
      filters.salaryMax.trim() ||
      filters.experience ||
      filters.jobType ||
      filters.skills.length,
  );
  const gpsOrigin = origins.find((o) => o.source === 'gps');
  const locationSummary = origins.map(originName).join(', ');

  function chip(origin: JobsSearchOrigin, index: number) {
    const name = originName(origin);
    return (
      <li key={`${name}-${index}`} className="jb-chip">
        <span title={name}>{name}</span>
        <button type="button" onClick={() => removeLocation(index)} aria-label={`Remove ${name}`}>
          <Icon name="x" small />
        </button>
      </li>
    );
  }

  const desktopSearchForm = (
    <form
      onSubmit={(event) => applyFiltersAndReload(event)}
      className="jb-form"
      role="search"
      aria-label="Job search"
    >
      <div className="jb-sb">
        <div className="jb-cell jb-cell--loc" ref={locCellRef}>
          <label className="jb-lbl" htmlFor="jb-add-location">
            Location
          </label>
          <div className="jb-fld jb-loc-fld">
            <Icon name="pin" />
            {origins.length ? (
              <ul className="jb-chips" aria-label="Selected locations">
                {origins.map(chip)}
              </ul>
            ) : null}
            {origins.length > VISIBLE_CHIPS ? (
              <button
                ref={moreBtnRef}
                type="button"
                className="jb-more"
                aria-haspopup="true"
                aria-expanded={allLocationsOpen}
                aria-controls="jb-all-locations"
                aria-label={`Show all ${origins.length} locations`}
                onClick={() => setAllLocationsOpen((open) => !open)}
              >
                +{origins.length - VISIBLE_CHIPS}
              </button>
            ) : null}
            <input
              id="jb-add-location"
              className="jb-add"
              list="jb-city-suggestions"
              value={locInput}
              onChange={onLocationChange}
              onKeyDown={onLocationKeyDown}
              placeholder={
                origins.length >= MAX_LOCATIONS
                  ? `Max ${MAX_LOCATIONS} locations`
                  : origins.length
                    ? 'Add more...'
                    : 'Add a city...'
              }
              aria-describedby="jb-location-message"
              autoComplete="off"
            />
          </div>
          {allLocationsOpen && origins.length > VISIBLE_CHIPS ? (
            <div className="jb-locpanel" id="jb-all-locations">
              <p>
                Selected locations ({origins.length}/{MAX_LOCATIONS})
              </p>
              <ul className="jb-chips">{origins.map(chip)}</ul>
            </div>
          ) : null}
        </div>

        <div className="jb-cell">
          <label className="jb-lbl" htmlFor="jb-keyword">
            Job title / skill
          </label>
          <div className="jb-fld">
            <Icon name="brief" />
            <input
              id="jb-keyword"
              name="q"
              value={filters.q}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder="e.g. Sales, React, Fresher"
              autoComplete="off"
            />
          </div>
        </div>

        <JobLocationFields
          state={filters.state}
          city={filters.city}
          onStateChange={(state) => updateFilters({ state, city: '' })}
          onCityChange={(city) => updateFilters({ city })}
        />

        <div className="jb-cell jb-cell--go">
          <Button
            type="submit"
            block={false}
            loading={loading}
            loadingLabel="Searching..."
            className="jb-go"
          >
            <Icon name="search" />
            {origins.length ? 'Apply filters' : 'Search near city'}
          </Button>
        </div>
      </div>
      <datalist id="jb-city-suggestions">
        {CITY_SUGGESTIONS.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
      <p className="jb-loc-msg" id="jb-location-message" role="status">
        {locMessage}
      </p>

      <section className="jb-section" aria-labelledby="jb-popular-title">
        <h2 className="jb-sec-t" id="jb-popular-title">
          Popular Cities
        </h2>
        <div className="jb-pills">
          {POPULAR_CITIES.map((item) => (
            <button
              key={item.city}
              type="button"
              className="jb-pill"
              aria-pressed={origins.some(
                (o) => normalizeCityKey(originName(o)) === normalizeCityKey(item.city),
              )}
              onClick={() => togglePopularCity(item.city)}
            >
              <Icon name={`city-${item.city.toLowerCase()}`} />
              {item.city}
            </button>
          ))}
        </div>
      </section>

      <div className="jb-section">
        <JobSearchFilters
          activeFilter={activeFilter}
          onToggleFilter={toggleFilter}
          filters={filters}
          onChange={updateFilters}
        />
      </div>

      {hasActiveFilters || locStatus === 'denied' ? (
        <div className="jb-form-actions">
          {hasActiveFilters ? (
            <button type="button" className="jb-btn jb-btn--ghost" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
          {locStatus === 'denied' ? (
            <button type="button" className="jb-btn jb-btn--soft" onClick={() => void tryUseGps()}>
              <Icon name="pin" small />
              Allow location
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );

  return (
    <CandidateAppShell
      activeTab="jobs"
      maxWidth="max-w-none"
      mobileJobsFilterMode={Boolean(origins.length)}
      onMobileJobsFilter={() => setMobileFilterOpen(true)}
    >
      <div className="jb">
        <div className="jb-ph">
          <div className="jb-ph-l">
            <Icon name="pin" />
            <div>
              <h1 className="jb-h1">Jobs Near You</h1>
              <p className="jb-sub">Discover the best opportunities in your area</p>
            </div>
          </div>
          <button
            type="button"
            className="jb-btn jb-btn--soft jb-locate"
            onClick={() => void tryUseGps()}
            disabled={locStatus === 'asking'}
          >
            <Icon name="pin" small />
            <span>
              {locStatus === 'asking'
                ? 'Locating…'
                : gpsOrigin
                  ? `${originName(gpsOrigin)} · Current location`
                  : 'Allow Location'}
            </span>
          </button>
        </div>

        {locStatus === 'asking' ? (
          <div className="jb-notice">
            <p className="jb-notice-title">Allow location access to see jobs near you.</p>
            <button type="button" className="jb-btn jb-btn--sm" onClick={() => void tryUseGps()}>
              <Icon name="pin" small />
              Grant location
            </button>
          </div>
        ) : null}
        {locStatus === 'denied' && !origins.length ? (
          <div className="jb-notice">
            <div>
              <p className="jb-notice-title">Location access is unavailable.</p>
              <p className="jb-notice-text">Use your preferred city or grant location.</p>
            </div>
            <div className="jb-notice-actions">
              <button type="button" className="jb-btn jb-btn--sm jb-btn--soft" onClick={usePreferredCity}>
                Use preferred location
              </button>
              <button type="button" className="jb-btn jb-btn--sm" onClick={() => void tryUseGps()}>
                <Icon name="pin" small />
                Grant location
              </button>
            </div>
          </div>
        ) : null}

        {origins.length && !showDesktopSearch ? (
          <div className="md:hidden">
            <ul className="jb-chips jb-mchips" aria-label="Selected locations">
              {origins.map(chip)}
            </ul>
          </div>
        ) : null}

        {showSearchForm ? (
          <div className={origins.length && !showDesktopSearch ? 'hidden md:block' : 'block'}>
            {desktopSearchForm}
          </div>
        ) : null}

        {origins.length && !showDesktopSearch ? (
          <div className="jb-filter-toggle hidden md:flex">
            <button type="button" className="jb-btn jb-btn--soft" onClick={() => setShowDesktopSearch(true)}>
              <Icon name="filter" small />
              Filter
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="jb-results">
            <ErrorState
              message={origins.length ? LOAD_ERROR_MESSAGE : error}
              onRetry={origins.length ? retryLoad : undefined}
            />
          </div>
        ) : null}

        {!origins.length && !error && (locStatus === 'idle' || locStatus === 'asking') ? (
          <div className="jb-results">
            <SkeletonList rows={3} label="Finding jobs near you…" />
          </div>
        ) : null}

        {!origins.length && !error && locStatus === 'ready' ? (
          <div className="jb-results">
            <EmptyState
              title="Add a location"
              message="Add a city above, pick a popular city, or allow location access to see jobs near you."
            />
          </div>
        ) : null}

        {origins.length ? (
          <div className="jb-results">
            {totalShown > 0 ? (
              <div className="jb-res-h">
                <p className="jb-count" data-testid="jobs-count" aria-live="polite">
                  {totalShown}
                  {cursor.ended ? '' : '+'} {totalShown === 1 && cursor.ended ? 'job' : 'jobs'} found
                </p>
                <div className="jb-res-r">
                  <p className="jb-res-sub">{locationSummary}</p>
                  {hasActiveFilters ? (
                    <button type="button" onClick={clearFilters} className="jb-linkbtn">
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {sections.map((section) => (
              <section key={section.key} className="jb-bucket">
                <h2 className="jb-bucket-t">{section.label}</h2>
                <div className="jb-grid">
                  {section.jobs.map((job) => {
                    const salary = formatSalaryCompact(job.salaryMin, job.salaryMax);
                    const logo = companyLogo(job.companyName);
                    const skills = jobSkills(job);
                    const shownSkills = skills.slice(0, 4);
                    const posted = formatPosted(job.publishedAt);
                    return (
                      <article key={job.id} className="jb-job" aria-labelledby={`jb-job-${job.id}`}>
                        <div className="jb-jt">
                          <span
                            className="jb-logo"
                            style={{ background: logo.background, color: logo.color }}
                            aria-hidden
                          >
                            {logo.initials}
                          </span>
                          <div className="jb-t">
                            <h3 className="jb-title" id={`jb-job-${job.id}`}>
                              {job.title}
                            </h3>
                            <p className="jb-co">{job.companyName}</p>
                          </div>
                          <button
                            type="button"
                            disabled={savingId === job.id}
                            onClick={(event) => void toggleSaveJob(event, job)}
                            className="jb-save"
                            aria-pressed={Boolean(job.saved)}
                            aria-label={job.saved ? 'Unsave job' : 'Save job'}
                          >
                            <Icon name="bookmark" small />
                          </button>
                        </div>

                        {job.match ? <span className="jb-match">{job.match.score}% match</span> : null}

                        {job.city || typeof job.distanceKm === 'number' ? (
                          <p className="jb-loc">
                            <Icon name="pin" small />
                            <span>
                              {job.city || 'Nearby'}
                              {typeof job.distanceKm === 'number' ? (
                                <b> · {job.distanceKm.toFixed(1)} km away</b>
                              ) : null}
                            </span>
                          </p>
                        ) : null}

                        <ul className="jb-facts">
                          {job.experience ? (
                            <li>
                              <Icon name="clock" small />
                              <span className="sr-only">Experience: </span>
                              {job.experience}
                            </li>
                          ) : null}
                          {salary ? (
                            <li>
                              <Icon name="wallet" small />
                              <span className="sr-only">Salary: </span>
                              {salary.main} {salary.suffix}
                            </li>
                          ) : null}
                          {formatJobType(job.jobType) ? (
                            <li>
                              <Icon name="brief" small />
                              <span className="sr-only">Job type: </span>
                              {formatJobType(job.jobType)}
                            </li>
                          ) : null}
                          {job.workMode ? (
                            <li>
                              <Icon name="build" small />
                              <span className="sr-only">Work mode: </span>
                              {formatWorkMode(job.workMode)}
                            </li>
                          ) : null}
                        </ul>

                        {shownSkills.length ? (
                          <ul className="jb-skills" aria-label="Skills">
                            {shownSkills.map((skill) => (
                              <li key={skill}>{skill}</li>
                            ))}
                            {skills.length > shownSkills.length ? (
                              <li>+{skills.length - shownSkills.length}</li>
                            ) : null}
                          </ul>
                        ) : null}

                        <div className="jb-jf">
                          {posted ? <span className="jb-posted">{posted}</span> : null}
                          <div className="jb-jf-act">
                            <Link href={`/jobs/${job.id}`} className="jb-btn jb-btn--sm jb-btn--ghost">
                              View
                            </Link>
                            {job.applied ? (
                              <button type="button" disabled className="jb-btn jb-btn--sm jb-btn--applied">
                                Applied
                              </button>
                            ) : (
                              <Link href={`/jobs/${job.id}/apply`} className="jb-btn jb-btn--sm">
                                Apply
                              </Link>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            {!loading && !error && totalShown === 0 && locStatus === 'ready' && cursor.ended ? (
              <EmptyState
                title="No jobs found"
                message={
                  hasActiveFilters
                    ? 'No jobs found matching your criteria. Try adjusting your filters.'
                    : 'Currently no match found with your profile. We will notify you when a suitable role opens up near this location.'
                }
                actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
                onAction={hasActiveFilters ? clearFilters : undefined}
              />
            ) : null}

            {loading || (totalShown === 0 && !error && !cursor.ended) ? (
              <SkeletonList rows={totalShown ? 1 : 3} label="Loading nearby jobs…" />
            ) : null}

            {cursor.ended && totalShown > 0 ? (
              <p className="jb-end">
                {origins.length > 1
                  ? "You've reached the end of jobs within 50 km of your selected locations."
                  : "You've reached the end of jobs within 50 km."}
              </p>
            ) : !cursor.ended && !error ? (
              <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
            ) : null}
          </div>
        ) : null}
      </div>

      {mobileFilterOpen ? (
        <div className="jb-mfilter" role="dialog" aria-modal="true" aria-labelledby="jb-mfilter-title">
          <div className="jb-mfilter-head">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="jb-mfilter-back"
              aria-label="Close filters"
            >
              <Icon name="back" />
            </button>
            <h2 id="jb-mfilter-title">Filters</h2>
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
          <p className="text-sm text-[#53689f]">Loading jobs…</p>
        </CandidateAppShell>
      }
    >
      <JobsSearchContent />
    </Suspense>
  );
}
