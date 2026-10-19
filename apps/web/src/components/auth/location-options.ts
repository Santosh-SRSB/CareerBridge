import { CITIES_BY_STATE } from '@careerbridge/shared';

export type LocationOption = {
  value: string;
  label: string;
  city: string;
  state: string;
};

export const LOCATION_OPTIONS: LocationOption[] = Object.entries(CITIES_BY_STATE)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([state, cities]) =>
    cities.map((city) => ({
      value: `${state}|${city}`,
      label: `${city}, ${state}`,
      city,
      state,
    })),
  );

export function filterLocationOptions(query: string, limit = 40): LocationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return LOCATION_OPTIONS.slice(0, limit);
  return LOCATION_OPTIONS.filter(
    (opt) =>
      opt.city.toLowerCase().includes(q) ||
      opt.state.toLowerCase().includes(q) ||
      opt.label.toLowerCase().includes(q),
  ).slice(0, limit);
}

export function labelForLocationValue(value: string): string {
  if (!value) return '';
  const match = LOCATION_OPTIONS.find((opt) => opt.value === value);
  if (match) return match.label;
  const [state, city] = value.split('|');
  return city && state ? `${city}, ${state}` : value;
}
