'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INDIAN_CITIES } from '@careerbridge/shared';
import {
  OnboardingActions,
  OnboardingError,
  OnboardingFieldIcon,
  OnboardingFrame,
  OnboardingIcon,
  OnboardingLoading,
  OnboardingQuestion,
  OnboardingStepHeader,
  obxPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import { patchStoredUser } from '@/lib/session';
import { getCandidateMe, listAllPublicCities, listPublicStates, updateCandidateMe } from '@/lib/api';
import { nextOnboardingStepPath, withSkippedStep } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { ONBOARDING_SAVE_ERROR, useOnboardingSkip } from '@/hooks/useOnboardingSkip';
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

const BUNDLED_WORK_CITIES = [
  ...POPULAR_WORK_CITIES,
  ...INDIAN_CITIES,
  ...REGISTRATION_CITIES,
  'Bangalore',
  'Gurugram',
  'Gurgaon',
  'New Delhi',
];

function buildCityCatalog(apiCities: string[]): string[] {
  return [...new Set([...apiCities, ...BUNDLED_WORK_CITIES])].sort((a, b) => a.localeCompare(b));
}

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

const MAX_WORK_CITIES = 5;
const MAX_WORK_CITIES_MESSAGE = 'You can select up to 5 locations';

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
  const [saveFailed, setSaveFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const gateReady = useOnboardingGate(1);
  const [profileReady, setProfileReady] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [apiCities, setApiCities] = useState<string[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const { skip, skipping, skipError } = useOnboardingSkip(1, skippedSteps);
  const ready = gateReady && profileReady;
  const workCityCatalog = useMemo(() => buildCityCatalog(apiCities), [apiCities]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPublicStates(), listAllPublicCities()])
      .then(([stateRows, cityRows]) => {
        if (cancelled) return;
        setStates(stateRows.map((row) => row.name));
        setApiCities(cityRows.map((row) => row.name));
      })
      .catch(() => {
        if (!cancelled) setStates([...INDIA_STATES]);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const otherHits = workCityCatalog.filter(
      (city) =>
        notSelected(city) &&
        cityMatchesQuery(city, q) &&
        !popularHits.some((p) => p.toLowerCase() === city.toLowerCase()),
    );

    return [...popularHits, ...otherHits].slice(0, 20);
  }, [customCity, workCities, workCityCatalog]);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setState(profile.state?.trim() || '');
        setWorkCities(parseCities(profile.preferredWorkCity || profile.city));
        setSkippedSteps(profile.onboardingSkippedSteps ?? []);
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  function isSelected(city: string) {
    return workCities.some((c) => c.toLowerCase() === city.toLowerCase());
  }

  function toggleCity(city: string) {
    if (isSelected(city)) {
      setError('');
      setWorkCities((prev) => prev.filter((c) => c.toLowerCase() !== city.toLowerCase()));
      return;
    }
    if (workCities.length >= MAX_WORK_CITIES) {
      setError(MAX_WORK_CITIES_MESSAGE);
      return;
    }
    setError('');
    setWorkCities((prev) => [...prev, city]);
  }

  function addCustomCity(raw?: string) {
    const city = (raw ?? customCity).trim();
    if (city.length < 2) return;
    if (isSelected(city)) {
      setCustomCity('');
      return;
    }
    if (workCities.length >= MAX_WORK_CITIES) {
      setError(MAX_WORK_CITIES_MESSAGE);
      return;
    }
    setWorkCities((prev) => [...prev, city]);
    setCustomCity('');
    setError('');
  }

  async function saveAndContinue() {
    setSaveFailed(false);
    if (!state.trim()) {
      setError('Please select your current location');
      return false;
    }
    if (workCities.length > MAX_WORK_CITIES) {
      setError(MAX_WORK_CITIES_MESSAGE);
      return false;
    }
    setError('');
    setLoading(true);
    try {
      const preferredWorkCity = serializeCities(workCities);
      const profile = await updateCandidateMe({
        state: state.trim(),
        preferredWorkCity,
        ...(workCities[0] ? { city: workCities[0] } : {}),
        openToRelocating: true,
        onboardingSkippedSteps: withSkippedStep(skippedSteps, 1, false),
      });
      patchStoredUser({ firstName: profile.firstName });
      router.push(nextOnboardingStepPath(1));
      return true;
    } catch {
      setError(ONBOARDING_SAVE_ERROR);
      setSaveFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveAndContinue();
  }

  if (!ready) return <OnboardingLoading step={1} />;

  return (
    <OnboardingFrame step={1} onSkip={() => void skip()} skipDisabled={skipping || loading}>
      <form onSubmit={onSubmit} className="obx-form">
        <div className="obx-body">
          <OnboardingStepHeader
            icon="pin"
            title="Where are you based?"
            subtitle="This helps us match jobs near you."
          />

          <OnboardingQuestion title="Current location" htmlFor="current-state">
            {locationsLoading ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="location-skeleton"
                className="obx-skel"
                style={{ height: 46 }}
              >
                <span className="sr-only">Loading locations…</span>
              </div>
            ) : (
              <div className="obx-field is-select">
                <OnboardingFieldIcon>
                  <OnboardingIcon name="pin" size={18} />
                </OnboardingFieldIcon>
                <select
                  id="current-state"
                  aria-label="Current location"
                  aria-invalid={error === 'Please select your current location' || undefined}
                  value={state}
                  onChange={(event) => {
                    setState(event.target.value);
                    if (event.target.value) setError('');
                  }}
                >
                  <option value="">Select state</option>
                  {(states.includes(state) || !state ? states : [state, ...states]).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </OnboardingQuestion>

          <OnboardingQuestion title="Preferred locations" hint={`Optional, up to ${MAX_WORK_CITIES}`} htmlFor="custom-work-city">
            {workCities.length > 0 ? (
              <div className="obx-chips">
                {workCities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="obx-opt obx-chip is-on"
                    aria-label={`Remove ${city}`}
                  >
                    {city}
                    <b aria-hidden>×</b>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="obx-field">
              <OnboardingFieldIcon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                aria-label="Search preferred city"
                placeholder="Search cities, e.g. Mumbai"
                autoComplete="off"
              />
              {searchOpen && citySuggestions.length > 0 ? (
                <ul className="obx-menu">
                  {!customCity.trim() ? (
                    <li className="obx-menu-head">Popular places (choose up to {MAX_WORK_CITIES})</li>
                  ) : null}
                  {citySuggestions.map((city) => (
                    <li key={city}>
                      <button
                        type="button"
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
            </div>
            {customCity.trim().length >= 2 &&
            !citySuggestions.some((c) => c.toLowerCase() === customCity.trim().toLowerCase()) ? (
              <button
                type="button"
                onClick={() => {
                  addCustomCity();
                  setSearchOpen(false);
                }}
                className="obx-link"
              >
                Add “{customCity.trim()}”
              </button>
            ) : null}

            <p className="obx-cnt">
              Popular places · {workCities.length}/{MAX_WORK_CITIES} selected
            </p>
            <div className="obx-chips">
              {POPULAR_WORK_CITIES.map((city) => {
                const selected = workCities.some((c) => c.toLowerCase() === city.toLowerCase());
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`obx-opt obx-chip${selected ? ' is-on' : ''}`}
                    aria-pressed={selected}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </OnboardingQuestion>

          <OnboardingError
            message={error || skipError}
            onRetry={saveFailed ? () => void saveAndContinue() : skipError ? () => void skip() : undefined}
          />
        </div>

        <OnboardingActions step={1}>
          <Button
            type="submit"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={obxPrimaryButtonClass}
          >
            Continue
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
