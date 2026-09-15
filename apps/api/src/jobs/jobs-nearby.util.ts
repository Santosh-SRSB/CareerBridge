import {
  NEARBY_DISTANCE_BUCKETS,
  NEARBY_MAX_RADIUS_KM,
  type NearbyDistanceBucket,
} from '@careerbridge/shared';

export type NearbyQueryInput = {
  latitude: number;
  longitude: number;
  minDistanceKm?: number;
  maxDistanceKm?: number;
  page?: number;
  limit?: number;
  q?: string;
  type?: string;
  category?: string;
  experience?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  workMode?: string;
  /** When true, return remote jobs only (ignore distance). */
  remoteOnly?: boolean;
};

export function assertValidNearbyCoords(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Invalid latitude');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Invalid longitude');
  }
}

export function normalizeNearbyRadius(minRaw?: number, maxRaw?: number): {
  minKm: number;
  maxKm: number;
  inclusiveMax: boolean;
} {
  const minKm = Math.max(0, Number.isFinite(minRaw as number) ? Number(minRaw) : 0);
  let maxKm = Number.isFinite(maxRaw as number) ? Number(maxRaw) : 10;
  if (maxKm > NEARBY_MAX_RADIUS_KM) maxKm = NEARBY_MAX_RADIUS_KM;
  if (maxKm <= minKm) {
    throw new Error('maxDistanceKm must be greater than minDistanceKm');
  }
  const matched = NEARBY_DISTANCE_BUCKETS.find((b) => b.minKm === minKm && b.maxKm === maxKm);
  const inclusiveMax = matched?.inclusiveMax ?? maxKm >= NEARBY_MAX_RADIUS_KM;
  return { minKm, maxKm, inclusiveMax };
}

export function nextNearbyBucket(current: NearbyDistanceBucket): NearbyDistanceBucket | null {
  const idx = NEARBY_DISTANCE_BUCKETS.findIndex(
    (b) => b.minKm === current.minKm && b.maxKm === current.maxKm,
  );
  if (idx < 0) {
    const following = NEARBY_DISTANCE_BUCKETS.find((b) => b.minKm >= current.maxKm);
    return following ? { minKm: following.minKm, maxKm: following.maxKm } : null;
  }
  const next = NEARBY_DISTANCE_BUCKETS[idx + 1];
  return next ? { minKm: next.minKm, maxKm: next.maxKm } : null;
}

export function bucketLabel(minKm: number, maxKm: number): string {
  const found = NEARBY_DISTANCE_BUCKETS.find((b) => b.minKm === minKm && b.maxKm === maxKm);
  return found?.label || `${minKm}–${maxKm} km away`;
}

/** Pure haversine for unit tests (km). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInBucket(
  distanceKm: number,
  minKm: number,
  maxKm: number,
  inclusiveMax: boolean,
): boolean {
  if (distanceKm < minKm) return false;
  if (inclusiveMax) return distanceKm <= maxKm;
  return distanceKm < maxKm;
}

export function isRemoteWorkMode(workMode: string | null | undefined): boolean {
  return Boolean(workMode && /remote/i.test(workMode));
}
