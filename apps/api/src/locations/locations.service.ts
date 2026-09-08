import { Injectable } from '@nestjs/common';

/** Static fallback until State/City tables are added to Prisma schema. */
const STATES = [
  { id: 'tn', name: 'Tamil Nadu', code: 'TN' },
  { id: 'ka', name: 'Karnataka', code: 'KA' },
  { id: 'mh', name: 'Maharashtra', code: 'MH' },
  { id: 'dl', name: 'Delhi', code: 'DL' },
  { id: 'ts', name: 'Telangana', code: 'TS' },
  { id: 'ap', name: 'Andhra Pradesh', code: 'AP' },
  { id: 'kl', name: 'Kerala', code: 'KL' },
];

const CITIES: Record<string, Array<{ id: string; name: string; stateId: string }>> = {
  tn: [
    { id: 'chennai', name: 'Chennai', stateId: 'tn' },
    { id: 'coimbatore', name: 'Coimbatore', stateId: 'tn' },
    { id: 'madurai', name: 'Madurai', stateId: 'tn' },
  ],
  ka: [
    { id: 'bengaluru', name: 'Bengaluru', stateId: 'ka' },
    { id: 'mysuru', name: 'Mysuru', stateId: 'ka' },
  ],
  mh: [
    { id: 'mumbai', name: 'Mumbai', stateId: 'mh' },
    { id: 'pune', name: 'Pune', stateId: 'mh' },
  ],
  dl: [{ id: 'new-delhi', name: 'New Delhi', stateId: 'dl' }],
  ts: [{ id: 'hyderabad', name: 'Hyderabad', stateId: 'ts' }],
  ap: [{ id: 'visakhapatnam', name: 'Visakhapatnam', stateId: 'ap' }],
  kl: [{ id: 'kochi', name: 'Kochi', stateId: 'kl' }],
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
