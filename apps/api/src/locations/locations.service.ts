import { Injectable } from '@nestjs/common';

/**
 * Official 28 Indian states only (no UTs) — keep in sync with
 * apps/web/src/data/india-locations.ts INDIA_STATES.
 */
const STATES = [
  { id: 'ap', name: 'Andhra Pradesh', code: 'AP' },
  { id: 'ar', name: 'Arunachal Pradesh', code: 'AR' },
  { id: 'as', name: 'Assam', code: 'AS' },
  { id: 'br', name: 'Bihar', code: 'BR' },
  { id: 'cg', name: 'Chhattisgarh', code: 'CG' },
  { id: 'ga', name: 'Goa', code: 'GA' },
  { id: 'gj', name: 'Gujarat', code: 'GJ' },
  { id: 'hr', name: 'Haryana', code: 'HR' },
  { id: 'hp', name: 'Himachal Pradesh', code: 'HP' },
  { id: 'jh', name: 'Jharkhand', code: 'JH' },
  { id: 'ka', name: 'Karnataka', code: 'KA' },
  { id: 'kl', name: 'Kerala', code: 'KL' },
  { id: 'mp', name: 'Madhya Pradesh', code: 'MP' },
  { id: 'mh', name: 'Maharashtra', code: 'MH' },
  { id: 'mn', name: 'Manipur', code: 'MN' },
  { id: 'ml', name: 'Meghalaya', code: 'ML' },
  { id: 'mz', name: 'Mizoram', code: 'MZ' },
  { id: 'nl', name: 'Nagaland', code: 'NL' },
  { id: 'od', name: 'Odisha', code: 'OD' },
  { id: 'pb', name: 'Punjab', code: 'PB' },
  { id: 'rj', name: 'Rajasthan', code: 'RJ' },
  { id: 'sk', name: 'Sikkim', code: 'SK' },
  { id: 'tn', name: 'Tamil Nadu', code: 'TN' },
  { id: 'ts', name: 'Telangana', code: 'TS' },
  { id: 'tr', name: 'Tripura', code: 'TR' },
  { id: 'up', name: 'Uttar Pradesh', code: 'UP' },
  { id: 'uk', name: 'Uttarakhand', code: 'UK' },
  { id: 'wb', name: 'West Bengal', code: 'WB' },
];

/** Representative cities per state (API fallback until City table exists). */
const CITIES: Record<string, Array<{ id: string; name: string; stateId: string }>> = {
  ap: [
    { id: 'visakhapatnam', name: 'Visakhapatnam', stateId: 'ap' },
    { id: 'vijayawada', name: 'Vijayawada', stateId: 'ap' },
  ],
  ar: [{ id: 'itanagar', name: 'Itanagar', stateId: 'ar' }],
  as: [
    { id: 'guwahati', name: 'Guwahati', stateId: 'as' },
    { id: 'silchar', name: 'Silchar', stateId: 'as' },
  ],
  br: [
    { id: 'patna', name: 'Patna', stateId: 'br' },
    { id: 'gaya', name: 'Gaya', stateId: 'br' },
  ],
  cg: [
    { id: 'raipur', name: 'Raipur', stateId: 'cg' },
    { id: 'bilaspur', name: 'Bilaspur', stateId: 'cg' },
  ],
  ga: [
    { id: 'panaji', name: 'Panaji', stateId: 'ga' },
    { id: 'margao', name: 'Margao', stateId: 'ga' },
  ],
  gj: [
    { id: 'ahmedabad', name: 'Ahmedabad', stateId: 'gj' },
    { id: 'surat', name: 'Surat', stateId: 'gj' },
  ],
  hr: [
    { id: 'gurugram', name: 'Gurugram', stateId: 'hr' },
    { id: 'faridabad', name: 'Faridabad', stateId: 'hr' },
  ],
  hp: [
    { id: 'shimla', name: 'Shimla', stateId: 'hp' },
    { id: 'dharamshala', name: 'Dharamshala', stateId: 'hp' },
  ],
  jh: [
    { id: 'ranchi', name: 'Ranchi', stateId: 'jh' },
    { id: 'jamshedpur', name: 'Jamshedpur', stateId: 'jh' },
  ],
  ka: [
    { id: 'bengaluru', name: 'Bengaluru', stateId: 'ka' },
    { id: 'mysuru', name: 'Mysuru', stateId: 'ka' },
  ],
  kl: [
    { id: 'kochi', name: 'Kochi', stateId: 'kl' },
    { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', stateId: 'kl' },
  ],
  mp: [
    { id: 'bhopal', name: 'Bhopal', stateId: 'mp' },
    { id: 'indore', name: 'Indore', stateId: 'mp' },
  ],
  mh: [
    { id: 'mumbai', name: 'Mumbai', stateId: 'mh' },
    { id: 'pune', name: 'Pune', stateId: 'mh' },
  ],
  mn: [{ id: 'imphal', name: 'Imphal', stateId: 'mn' }],
  ml: [{ id: 'shillong', name: 'Shillong', stateId: 'ml' }],
  mz: [{ id: 'aizawl', name: 'Aizawl', stateId: 'mz' }],
  nl: [{ id: 'kohima', name: 'Kohima', stateId: 'nl' }],
  od: [
    { id: 'bhubaneswar', name: 'Bhubaneswar', stateId: 'od' },
    { id: 'cuttack', name: 'Cuttack', stateId: 'od' },
  ],
  pb: [
    { id: 'ludhiana', name: 'Ludhiana', stateId: 'pb' },
    { id: 'amritsar', name: 'Amritsar', stateId: 'pb' },
  ],
  rj: [
    { id: 'jaipur', name: 'Jaipur', stateId: 'rj' },
    { id: 'udaipur', name: 'Udaipur', stateId: 'rj' },
  ],
  sk: [{ id: 'gangtok', name: 'Gangtok', stateId: 'sk' }],
  tn: [
    { id: 'chennai', name: 'Chennai', stateId: 'tn' },
    { id: 'coimbatore', name: 'Coimbatore', stateId: 'tn' },
    { id: 'madurai', name: 'Madurai', stateId: 'tn' },
  ],
  ts: [
    { id: 'hyderabad', name: 'Hyderabad', stateId: 'ts' },
    { id: 'warangal', name: 'Warangal', stateId: 'ts' },
  ],
  tr: [{ id: 'agartala', name: 'Agartala', stateId: 'tr' }],
  up: [
    { id: 'lucknow', name: 'Lucknow', stateId: 'up' },
    { id: 'noida', name: 'Noida', stateId: 'up' },
  ],
  uk: [
    { id: 'dehradun', name: 'Dehradun', stateId: 'uk' },
    { id: 'haridwar', name: 'Haridwar', stateId: 'uk' },
  ],
  wb: [
    { id: 'kolkata', name: 'Kolkata', stateId: 'wb' },
    { id: 'siliguri', name: 'Siliguri', stateId: 'wb' },
  ],
};

@Injectable()
export class LocationsService {
  listActiveStates() {
    return Promise.resolve(STATES);
  }

  listActiveCities(stateId?: string) {
    if (!stateId) {
      return Promise.resolve(
        Object.values(CITIES)
          .flat()
          .map((city) => ({
            ...city,
            state: STATES.find((state) => state.id === city.stateId) ?? null,
          })),
      );
    }
    const cities = CITIES[stateId] ?? [];
    const state = STATES.find((item) => item.id === stateId) ?? null;
    return Promise.resolve(cities.map((city) => ({ ...city, state })));
  }
}
