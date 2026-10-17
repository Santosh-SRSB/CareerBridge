import {
  NEARBY_DISTANCE_BUCKETS,
  type NearbyDistanceBucket,
  type NearbyJobsResponse,
} from '@careerbridge/shared';

export { NEARBY_DISTANCE_BUCKETS };

export type NearbyFeedSection = {
  key: string;
  label: string;
  remoteOnly?: boolean;
  minKm: number;
  maxKm: number;
  jobs: import('@careerbridge/shared').JobCard[];
};

export function nearbyBucketKey(bucket: NearbyDistanceBucket, remoteOnly?: boolean) {
  if (remoteOnly) return 'remote';
  return `${bucket.minKm}-${bucket.maxKm}`;
}

export function labelForBucket(bucket: NearbyDistanceBucket, remoteOnly?: boolean) {
  if (remoteOnly) return 'Remote jobs';
  const found = NEARBY_DISTANCE_BUCKETS.find(
    (b) => b.minKm === bucket.minKm && b.maxKm === bucket.maxKm,
  );
  return found?.label || `${bucket.minKm}–${bucket.maxKm} km away`;
}

export function requestKey(
  lat: number,
  lng: number,
  bucket: NearbyDistanceBucket,
  page: number,
  filterSig: string,
  remoteOnly?: boolean,
) {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}:${remoteOnly ? 'remote' : `${bucket.minKm}-${bucket.maxKm}`}:p${page}:${filterSig}`;
}

export type NearbyCursor = {
  bucketIndex: number;
  page: number;
  remotePhase: 'pending' | 'loading' | 'done' | 'skipped';
  ended: boolean;
};

export function initialNearbyCursor(): NearbyCursor {
  return {
    bucketIndex: 0,
    page: 1,
    remotePhase: 'pending',
    ended: false,
  };
}

export function advanceCursorFromResponse(
  cursor: NearbyCursor,
  res: NearbyJobsResponse,
): NearbyCursor {
  if (res.remoteOnly) {
    if (res.hasMoreInBucket && res.nextPage) {
      return { ...cursor, remotePhase: 'loading', page: res.nextPage };
    }
    return {
      bucketIndex: 0,
      page: 1,
      remotePhase: 'done',
      ended: false,
    };
  }

  if (res.hasMoreInBucket && res.nextPage) {
    return { ...cursor, page: res.nextPage, remotePhase: 'done' };
  }

  const nextIdx = cursor.bucketIndex + 1;
  if (nextIdx >= NEARBY_DISTANCE_BUCKETS.length) {
    return { ...cursor, ended: true, remotePhase: 'done' };
  }
  return {
    bucketIndex: nextIdx,
    page: 1,
    remotePhase: 'done',
    ended: false,
  };
}
