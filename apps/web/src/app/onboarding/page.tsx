'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INDIAN_CITIES } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingFieldIcon,
  OnboardingFrame,
  OnboardingHero,
  OnboardingQuestion,
  OnboardingStepHeader,
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

  if (!ready) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ background: OB.bg, color: OB.muted }}
      >
        Loading...
      </main>
    );
  }

  return (
    <OnboardingFrame step={1}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingHero tone="green" deco>
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke={OB.green800}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </OnboardingHero>

          <OnboardingStepHeader
            title="Where are you based?"
            subtitle="This helps us match jobs near you."
          />

          <OnboardingQuestion title="Current location">
            <div className="relative">
              <OnboardingFieldIcon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                </svg>
              </OnboardingFieldIcon>
              <select
                id="current-state"
                required
                value={state}
                onChange={(event) => setState(event.target.value)}
                className={`${onboardingInputClass} pl-[34px]`}
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

          <OnboardingQuestion title="Preferred location">
            {workCities.length > 0 ? (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {workCities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="inline-flex h-auto items-center gap-1.5 rounded-full border-0 px-2.5 py-1.5 text-[13px] text-white transition active:scale-95"
                    style={{ background: OB.accent }}
                    aria-label={`Remove ${city}`}
                  >
                    {city}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="relative mb-3.5 shrink-0">
              <OnboardingFieldIcon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </OnboardingFieldIcon>
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
                placeholder="Search city (e.g. Lucknow, Bangalore)..."
                className={`${onboardingInputClass} pl-[34px]`}
                autoComplete="off"
              />
              {searchOpen && citySuggestions.length > 0 ? (
                <ul
                  className="cb-ob-hide-scrollbar absolute z-30 mt-1 max-h-44 w-full rounded-[10px] border bg-white py-1 shadow-lg"
                  style={{ borderColor: OB.border }}
                >
                  {!customCity.trim() ? (
                    <li
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: OB.textMuted }}
                    >
                      Popular places (<strong style={{ color: OB.ink }}>you can choose many</strong>)
                    </li>
                  ) : null}
                  {citySuggestions.map((city) => (
                    <li key={city}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#E3F2ED]"
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
                  style={{ color: OB.accent }}
                >
                  Add “{customCity.trim()}”
                </button>
              ) : null}
            </div>

            <p className="mb-2 text-xs" style={{ color: OB.textMuted }}>
              Popular places (<strong style={{ color: OB.ink }}>you can choose many</strong>)
            </p>
            <div className="flex flex-wrap gap-2 pb-1">
              {POPULAR_WORK_CITIES.map((city) => {
                const selected = workCities.some((c) => c.toLowerCase() === city.toLowerCase());
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="h-auto rounded-full border px-3.5 py-2 text-[13px] transition active:scale-95"
                    style={
                      selected
                        ? { background: OB.accent, color: '#fff', borderColor: OB.accent }
                        : {
                            background: OB.surface,
                            color: OB.ink,
                            borderColor: OB.borderStrong,
                          }
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

        <OnboardingActions step={1}>
          <Button
            type="submit"
            size="sm"
            block
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.accent }}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
