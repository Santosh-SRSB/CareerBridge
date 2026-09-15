import { listCityCentroids, lookupCityCentroid } from '@careerbridge/shared';

export type JobsSearchOrigin = {
  latitude: number;
  longitude: number;
  label: string;
  source: 'gps' | 'preferred' | 'manual';
};

const STORAGE_KEY = 'cb.jobsSearchOrigin';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function titleCity(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Nearest known city centroid within maxKm (default 80 km). */
export function nearestCityName(
  latitude: number,
  longitude: number,
  maxKm = 80,
): string | null {
  let best: { name: string; km: number } | null = null;
  for (const city of listCityCentroids()) {
    const km = haversineKm(latitude, longitude, city.lat, city.lng);
    if (km > maxKm) continue;
    if (!best || km < best.km) best = { name: city.name, km };
  }
  return best ? titleCity(best.name) : null;
}

export function readStoredSearchOrigin(): JobsSearchOrigin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobsSearchOrigin;
    if (
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude) ||
      !parsed.label
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeSearchOrigin(origin: JobsSearchOrigin) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origin));
}

export function originFromCity(
  city: string,
  source: 'preferred' | 'manual' = 'preferred',
): JobsSearchOrigin | null {
  const hit = lookupCityCentroid(city);
  if (!hit) return null;
  return {
    latitude: hit.lat,
    longitude: hit.lng,
    label: city.trim() || hit.name,
    source,
  };
}

/** One-shot browser geolocation — does not watch position. */
export function requestBrowserLocation(
  timeoutMs = 10000,
  cityHint?: string | null,
): Promise<JobsSearchOrigin> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const hint = cityHint?.trim() ? lookupCityCentroid(cityHint)?.name : null;
        const nearest = nearestCityName(latitude, longitude);
        const cityName = (hint ? titleCity(hint) : null) || nearest;
        resolve({
          latitude,
          longitude,
          label: cityName || 'Current location',
          source: 'gps',
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}
