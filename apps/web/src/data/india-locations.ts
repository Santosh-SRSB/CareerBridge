import {
  INDIA_STATES,
  CITIES_BY_STATE,
  getCitiesForState,
  normalizeCityName,
  findStateForCity,
  type IndiaState,
} from '@careerbridge/shared';

export { INDIA_STATES, CITIES_BY_STATE, getCitiesForState, normalizeCityName, findStateForCity };
export type { IndiaState };

export function formatCityState(city: string, state: string): string {
  if (city && state) return `${city}, ${state}`;
  return city || state || '';
}

export function parseCityState(location: string): { city: string; state: string } {
  if (!location.trim()) return { city: '', state: '' };
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const statePart = parts[parts.length - 1];
    const cityPart = parts.slice(0, -1).join(', ');
    if ((INDIA_STATES as readonly string[]).includes(statePart)) {
      return { city: normalizeCityName(cityPart) || cityPart, state: statePart };
    }
  }
  for (const state of INDIA_STATES) {
    if (location.includes(state)) {
      const city = normalizeCityName(
        location.replace(state, '').replace(/,\s*$/, '').trim(),
      );
      return { city, state };
    }
  }
  const cityOnly = normalizeCityName(location) || location.trim();
  const inferred = findStateForCity(cityOnly);
  return { city: cityOnly, state: inferred };
}

export const REGISTRATION_CITIES = [
  ...new Set(INDIA_STATES.flatMap((state) => CITIES_BY_STATE[state])),
].sort((a, b) => a.localeCompare(b));
