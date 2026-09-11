'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INDIAN_CITIES } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFrame,
  OnboardingQuestion,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { patchStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { INDIA_STATES, REGISTRATION_CITIES } from '@/data/india-locations';

/** Quick-tap chips — also appear first in the search dropdown. */
const POPULAR_WORK_CITIES = [
  'Bangalore',
  'Gurugram',
  'Hyderabad',
  'Kochi',
  'Kolkata',
  'Mumbai',
  'Pune',
  'Chennai',
  'Noida',
  'Lucknow',
  'Ahmedabad',
  'Jaipur',
] as const;

/** Alternate spellings so search finds the right city. */
const CITY_SEARCH_ALIASES: Record<string, string[]> = {
  bangalore: ['bengaluru'],
  bengaluru: ['bangalore'],
  gurugram: ['gurgaon'],
  gurgaon: ['gurugram'],
  mumbai: ['bombay'],
  bombay: ['mumbai'],
  chennai: ['madras'],
  madras: ['chennai'],
  kolkata: ['calcutta'],
  calcutta: ['kolkata'],
  thiruvananthapuram: ['trivandrum'],
  trivandrum: ['thiruvananthapuram'],
  mysuru: ['mysore'],
  mysore: ['mysuru'],
  mangaluru: ['mangalore'],
  mangalore: ['mangaluru'],
  vadodara: ['baroda'],
  baroda: ['vadodara'],
  prayagraj: ['allahabad'],
  allahabad: ['prayagraj'],
  visakhapatnam: ['vizag'],
  vizag: ['visakhapatnam'],
};

const WORK_CITY_CATALOG = [
  ...new Set([
    ...POPULAR_WORK_CITIES,
    ...INDIAN_CITIES,
    ...REGISTRATION_CITIES,
    'Bangalore',
    'Gurugram',
    'Gurgaon',
    'New Delhi',
  ]),
].sort((a, b) => a.localeCompare(b));

function cityMatchesQuery(city: string, query: string): boolean {
  const c = city.toLowerCase();
  if (c.includes(query)) return true;
  const aliases = CITY_SEARCH_ALIASES[query] || [];
  if (aliases.some((a) => c.includes(a) || a.includes(query))) return true;
  // Also match if query is an alias of this city name
  for (const [key, alts] of Object.entries(CITY_SEARCH_ALIASES)) {
    if (c === key || c.includes(key)) {
      if (alts.some((a) => a.includes(query) || query.includes(a))) return true;
    }
  }
  return false;
}

function parseCities(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
}

function serializeCities(cities: string[]): string {
  return cities.map((c) => c.trim()).filter(Boolean).join(', ');
}

export default function OnboardingLocationPage() {
  const router = useRouter();
  const [state, setState] = useState('');
  const [workCities, setWorkCities] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(1);
  const [profileReady, setProfileReady] = useState(false);
  const ready = gateReady && profileReady;

  const citySuggestions = useMemo(() => {
    const q = customCity.trim().toLowerCase();
    const notSelected = (city: string) =>
      !workCities.some((w) => w.toLowerCase() === city.toLowerCase());

    // Empty / short focus: show popular places first
    if (q.length < 1) {
      return POPULAR_WORK_CITIES.filter(notSelected).slice(0, 16);
    }

    const popularHits = POPULAR_WORK_CITIES.filter(
      (city) => notSelected(city) && cityMatchesQuery(city, q),
    );
    const otherHits = WORK_CITY_CATALOG.filter(
      (city) =>
        notSelected(city) &&
        cityMatchesQuery(city, q) &&
        !popularHits.some((p) => p.toLowerCase() === city.toLowerCase()),
    );

    return [...popularHits, ...otherHits].slice(0, 20);
  }, [customCity, workCities]);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setState(profile.state?.trim() || '');
        setWorkCities(parseCities(profile.preferredWorkCity || profile.city));
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  function toggleCity(city: string) {
    setError('');
    setWorkCities((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === city.toLowerCase());
      if (exists) return prev.filter((c) => c.toLowerCase() !== city.toLowerCase());
      return [...prev, city];
    });
  }

  function addCustomCity(raw?: string) {
    const city = (raw ?? customCity).trim();
    if (city.length < 2) return;
    setWorkCities((prev) => {
      if (prev.some((c) => c.toLowerCase() === city.toLowerCase())) return prev;
      return [...prev, city];
    });
    setCustomCity('');
    setError('');
  }

  async function saveAndContinue() {
    if (!state.trim()) {
      setError('Select your state.');
      return false;
    }
    if (workCities.length < 1) {
      setError('Pick at least one place where you would like to work.');
      return false;
    }
    setError('');
    setLoading(true);
    try {
      const preferredWorkCity = serializeCities(workCities);
      const profile = await updateCandidateMe({
        state: state.trim(),
        preferredWorkCity,
        city: workCities[0],
        openToRelocating: true,
      });
      patchStoredUser({ firstName: profile.firstName });
      router.push(nextOnboardingStepPath(1));
      return true;
    } catch {
      setError('We could not save your location right now. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveAndContinue();
  }

  function onSkip() {
    router.push(nextOnboardingStepPath(1));
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={1}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3.5 overflow-x-hidden cb-ob-hide-scrollbar sm:space-y-4">
          <OnboardingQuestion title="Which state are you in?">
            <div className="relative">
              <select
                id="current-state"
                required
                value={state}
                onChange={(event) => setState(event.target.value)}
                className={onboardingInputClass}
              >
                <option value="">Select state</option>
                {INDIA_STATES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </OnboardingQuestion>

          <OnboardingQuestion title="Where would you like to work?">
            {workCities.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {workCities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="inline-flex items-center gap-0.5 rounded-full border px-2.5 py-1 text-xs font-medium text-white"
                    style={{ background: OB.moss, borderColor: OB.moss }}
                    aria-label={`Remove ${city}`}
                  >
                    {city}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="relative mb-2.5 shrink-0">
              <input
                id="custom-work-city"
                type="text"
                value={customCity}
                onChange={(e) => {
                  setCustomCity(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (citySuggestions[0]) addCustomCity(citySuggestions[0]);
                    else addCustomCity();
                    setSearchOpen(false);
                  }
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
                placeholder="Search city (e.g. Lucknow, Bangalore)…"
                className={onboardingInputClass}
                autoComplete="off"
              />
              {searchOpen && citySuggestions.length > 0 ? (
                <ul
                  className="cb-ob-hide-scrollbar absolute z-30 mt-1 max-h-44 w-full rounded-lg border bg-white py-1 shadow-lg"
                  style={{ borderColor: OB.line }}
                >
                  {!customCity.trim() ? (
                    <li
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: OB.muted }}
                    >
                      Popular places
                    </li>
                  ) : null}
                  {citySuggestions.map((city) => (
                    <li key={city}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#EEF2E9]"
                        style={{ color: OB.ink }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          addCustomCity(city);
                          setSearchOpen(false);
                        }}
                      >
                        {city}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {customCity.trim().length >= 2 &&
              !citySuggestions.some((c) => c.toLowerCase() === customCity.trim().toLowerCase()) ? (
                <button
                  type="button"
                  onClick={() => {
                    addCustomCity();
                    setSearchOpen(false);
                  }}
                  className="mt-1.5 text-xs font-semibold"
                  style={{ color: OB.moss }}
                >
                  Add “{customCity.trim()}”
                </button>
              ) : null}
            </div>

            <p className="mb-1.5 text-xs font-semibold" style={{ color: OB.muted }}>
              Popular places
            </p>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {POPULAR_WORK_CITIES.map((city) => {
                const selected = workCities.some((c) => c.toLowerCase() === city.toLowerCase());
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
                    style={
                      selected
                        ? { background: OB.moss, color: '#fff', borderColor: OB.moss }
                        : { background: '#fff', color: '#3D3A33', borderColor: '#7A8270' }
                    }
                    aria-pressed={selected}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </OnboardingQuestion>

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <OnboardingActions onSkip={onSkip}>
          <Button
            type="submit"
            size="sm"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.moss }}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
