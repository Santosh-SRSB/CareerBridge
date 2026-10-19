/**
 * Registration location search helpers. Run from apps/web:
 * node --experimental-strip-types --test src/components/auth/location-options.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCATION_OPTIONS, filterLocationOptions, labelForLocationValue } from './location-options';

describe('location-options', () => {
  it('indexes cities as State|City values with City, State labels', () => {
    const mumbai = LOCATION_OPTIONS.find((opt) => opt.city === 'Mumbai');
    assert.ok(mumbai);
    assert.equal(mumbai.value, 'Maharashtra|Mumbai');
    assert.equal(mumbai.label, 'Mumbai, Maharashtra');
    assert.equal(labelForLocationValue('Maharashtra|Mumbai'), 'Mumbai, Maharashtra');
  });

  it('filters by city name so users need not scroll state groups', () => {
    const matches = filterLocationOptions('pune');
    assert.ok(matches.some((opt) => opt.city === 'Pune' && opt.state === 'Maharashtra'));
  });

  it('filters by state name', () => {
    const matches = filterLocationOptions('kerala');
    assert.ok(matches.length > 0);
    assert.ok(matches.every((opt) => opt.state === 'Kerala'));
  });

  it('returns an empty list for nonsense queries', () => {
    assert.equal(filterLocationOptions('zzzz-no-such-city').length, 0);
  });
});
