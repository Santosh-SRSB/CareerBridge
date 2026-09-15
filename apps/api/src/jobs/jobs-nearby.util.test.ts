import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertValidNearbyCoords,
  bucketLabel,
  haversineKm,
  isInBucket,
  isRemoteWorkMode,
  nextNearbyBucket,
  normalizeNearbyRadius,
} from './jobs-nearby.util';

describe('jobs-nearby.util', () => {
  it('validates coordinates', () => {
    assert.doesNotThrow(() => assertValidNearbyCoords(12.97, 77.59));
    assert.throws(() => assertValidNearbyCoords(100, 77));
    assert.throws(() => assertValidNearbyCoords(12, 200));
  });

  it('caps radius at 50 km', () => {
    const r = normalizeNearbyRadius(0, 100);
    assert.equal(r.maxKm, 50);
    assert.equal(r.inclusiveMax, true);
  });

  it('rejects inverted range', () => {
    assert.throws(() => normalizeNearbyRadius(20, 10));
  });

  it('bucket boundaries: 0-10 exclusive max', () => {
    assert.equal(isInBucket(0, 0, 10, false), true);
    assert.equal(isInBucket(9.99, 0, 10, false), true);
    assert.equal(isInBucket(10, 0, 10, false), false);
  });

  it('bucket boundaries: 10-20', () => {
    assert.equal(isInBucket(10, 10, 20, false), true);
    assert.equal(isInBucket(19.99, 10, 20, false), true);
    assert.equal(isInBucket(20, 10, 20, false), false);
  });

  it('bucket boundaries: 20-30', () => {
    assert.equal(isInBucket(20, 20, 30, false), true);
    assert.equal(isInBucket(30, 20, 30, false), false);
  });

  it('bucket boundaries: 30-50 inclusive max', () => {
    assert.equal(isInBucket(30, 30, 50, true), true);
    assert.equal(isInBucket(50, 30, 50, true), true);
    assert.equal(isInBucket(50.01, 30, 50, true), false);
  });

  it('nextNearbyBucket advances rings', () => {
    assert.deepEqual(nextNearbyBucket({ minKm: 0, maxKm: 10 }), { minKm: 10, maxKm: 20 });
    assert.deepEqual(nextNearbyBucket({ minKm: 10, maxKm: 20 }), { minKm: 20, maxKm: 30 });
    assert.deepEqual(nextNearbyBucket({ minKm: 20, maxKm: 30 }), { minKm: 30, maxKm: 50 });
    assert.equal(nextNearbyBucket({ minKm: 30, maxKm: 50 }), null);
  });

  it('haversine is ~0 for same point', () => {
    assert.ok(haversineKm(12.97, 77.59, 12.97, 77.59) < 0.01);
  });

  it('haversine Bangalore–Whitefield roughly 15–20 km', () => {
    const d = haversineKm(12.9716, 77.5946, 12.9698, 77.75);
    assert.ok(d > 10 && d < 25, `got ${d}`);
  });

  it('labels and remote detection', () => {
    assert.equal(bucketLabel(0, 10), 'Within 10 km');
    assert.equal(isRemoteWorkMode('Remote'), true);
    assert.equal(isRemoteWorkMode('Hybrid'), false);
  });
});
