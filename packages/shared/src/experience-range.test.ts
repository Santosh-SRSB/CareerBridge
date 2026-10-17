import assert from 'node:assert/strict';
import test from 'node:test';
import { experienceFitPercent, jobMatchesExperienceFilter, parseExperienceRange } from './experience-range';
import { atsMatchBandInfo, atsMatchBandLabel, toJobExperienceRange } from './marketplace';

test('parses current and legacy experience labels', () => {
  assert.deepEqual(parseExperienceRange('Fresher'), { min: 0, max: 0 });
  assert.deepEqual(parseExperienceRange('0 - 1 Years'), { min: 0, max: 1 });
  assert.deepEqual(parseExperienceRange('2–5 yrs'), { min: 2, max: 5 });
  assert.deepEqual(parseExperienceRange('5+ yrs'), { min: 5, max: Number.POSITIVE_INFINITY });
  assert.equal(parseExperienceRange('NONE'), null);
});

test('experience filter matches wizard labels regardless of spacing', () => {
  assert.equal(jobMatchesExperienceFilter('0 - 1 Years', '0-1'), true);
  assert.equal(jobMatchesExperienceFilter('0–1 yr', '0-1'), true);
  assert.equal(jobMatchesExperienceFilter('0 - 1 Years', '2-5'), false);
  assert.equal(jobMatchesExperienceFilter('2 - 4 Years', '2-5'), true);
  assert.equal(jobMatchesExperienceFilter('Fresher', 'fresher'), true);
  assert.equal(jobMatchesExperienceFilter('8+ Years', '5+'), true);
  assert.equal(jobMatchesExperienceFilter(null, '2-5'), true);
});

test('experience fit: inside band 100, adjacent 50', () => {
  assert.equal(experienceFitPercent(3, '2 - 4 Years'), 100);
  assert.equal(experienceFitPercent(1.5, '2 - 4 Years'), 50);
  assert.equal(experienceFitPercent(0, '5+ yrs'), 0);
  assert.equal(experienceFitPercent(2, null), null);
});

test('legacy labels map to the nearest current option', () => {
  assert.equal(toJobExperienceRange('2 - 4 Years'), '2–5 yrs');
  assert.equal(toJobExperienceRange('8+ Years'), '5+ yrs');
  assert.equal(toJobExperienceRange('Fresher'), 'Fresher');
  assert.equal(toJobExperienceRange('0 - 1 Years'), '0–1 yr');
});

test('handbook match bands', () => {
  assert.equal(atsMatchBandLabel(91), 'Excellent Match');
  assert.equal(atsMatchBandLabel(82), 'Good Match');
  assert.equal(atsMatchBandLabel(65), 'Moderate Match');
  assert.equal(atsMatchBandLabel(35), 'Low Match');
  assert.equal(atsMatchBandInfo(82).color, 'blue');
  assert.equal(atsMatchBandInfo(65).color, 'amber');
});
