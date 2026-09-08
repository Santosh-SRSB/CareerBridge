'use client';

import { useEffect, useState } from 'react';
import type { LocationCity, LocationState } from '@careerbridge/shared';
import { listPublicCities, listPublicStates } from '@/lib/api';

export function StateCityFields({
  stateId,
  cityId,
  onStateChange,
  onCityChange,
  required = true,
}: {
  stateId: string;
  cityId: string;
  onStateChange: (stateId: string, stateName: string) => void;
  onCityChange: (cityId: string, cityName: string) => void;
  required?: boolean;
}) {
  const [states, setStates] = useState<LocationState[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listPublicStates()
      .then(setStates)
      .catch(() => setError('Could not load states. Ask Admin to add locations.'))
      .finally(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    listPublicCities(stateId)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [stateId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block" htmlFor="reg-state">
        <span className="mb-1.5 block text-xs font-bold text-primary">State</span>
        <select
          id="reg-state"
          required={required}
          disabled={loadingStates}
          value={stateId}
          onChange={(event) => {
            const next = event.target.value;
            const match = states.find((item) => item.id === next);
            onStateChange(next, match?.name || '');
            onCityChange('', '');
          }}
          className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-xs font-semibold text-primary outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20 disabled:opacity-60"
        >
          <option value="">{loadingStates ? 'Loading states…' : 'Select state'}</option>
          {states.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block" htmlFor="reg-city">
        <span className="mb-1.5 block text-xs font-bold text-primary">City</span>
        <select
          id="reg-city"
          required={required}
          disabled={!stateId || loadingCities}
          value={cityId}
          onChange={(event) => {
            const next = event.target.value;
            const match = cities.find((item) => item.id === next);
            onCityChange(next, match?.name || '');
          }}
          className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-xs font-semibold text-primary outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20 disabled:opacity-60"
        >
          <option value="">
            {!stateId ? 'Select state first' : loadingCities ? 'Loading cities…' : 'Select city'}
          </option>
          {cities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="sm:col-span-2 text-xs text-error font-medium">{error}</p> : null}
    </div>
  );
}
