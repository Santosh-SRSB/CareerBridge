import assert from 'node:assert/strict';
import {
  CAREER_GAP_THRESHOLD_DAYS,
  computeTimelineCareerGaps,
  daysBetweenDates,
  formatGapDurationFromDays,
  mergeActivityRanges,
  parseIsoDate,
} from './career-timeline-gaps';

function d(iso: string) {
  return parseIsoDate(iso)!;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

assert.equal(CAREER_GAP_THRESHOLD_DAYS, 30);
assert.equal(daysBetweenDates(d('2022-08-01'), d('2022-09-15')), 45);

// Between-job thresholds
{
  const result = computeTimelineCareerGaps({
    activities: [
      { id: 'a', startDate: '2022-01-01', endDate: '2022-08-01' },
      { id: 'b', startDate: '2022-08-30', endDate: '2022-12-01' },
    ],
    now: d('2022-12-15'),
  });
  assert.equal(result.totalGaps, 0); // 29 days + short trailing ignored if <=30
}

{
  const result = computeTimelineCareerGaps({
    activities: [
      { id: 'a', startDate: '2022-01-01', endDate: '2022-08-01' },
      { id: 'b', startDate: '2022-09-01', endDate: '2022-12-01', stillInCompany: true },
    ],
    now: d('2026-01-01'),
  });
  assert.equal(result.totalGaps, 1);
  assert.equal(result.gaps[0].gapDays, 31);
}

// Overlapping → no false between-gap
{
  const result = computeTimelineCareerGaps({
    activities: [
      { id: 'a', startDate: '2022-01-01', endDate: '2023-12-01' },
      { id: 'b', startDate: '2023-06-01', endDate: '2024-02-01' },
      { id: 'c', startDate: '2024-03-01', stillInCompany: true },
    ],
    now: d('2026-01-01'),
  });
  assert.equal(result.totalGaps, 0);
}

// Current employment → no trailing gap
{
  const result = computeTimelineCareerGaps({
    activities: [
      { id: 'a', startDate: '2024-01-01', endDate: '2024-06-01' },
      { id: 'b', startDate: '2024-08-01', stillInCompany: true },
    ],
    now: d('2026-03-01'),
  });
  assert.equal(result.totalGaps, 1);
  assert.ok(result.gaps[0].gapDays > 30);
}

// Fresher: graduated March 2026, applying Sep 2026 → gap shown
{
  const result = computeTimelineCareerGaps({
    activities: [],
    educationEndDate: '2026-03',
    now: d('2026-09-22'),
  });
  assert.equal(result.totalGaps, 1);
  assert.ok(result.gaps[0].gapDays > 30);
  assert.equal(result.gaps[0].gapStartDate, '2026-03-31');
  assert.equal(result.gaps[0].gapEndDate, '2026-09-22');
}

// Fresher still studying → no gap
{
  const result = computeTimelineCareerGaps({
    activities: [],
    educationEndDate: '2026-03',
    stillStudying: true,
    now: d('2026-09-22'),
  });
  assert.equal(result.totalGaps, 0);
}

// Education → first job gap
{
  const result = computeTimelineCareerGaps({
    activities: [{ id: 'job1', startDate: '2026-08-01', stillInCompany: true }],
    educationEndDate: '2026-03',
    now: d('2026-09-22'),
  });
  assert.equal(result.totalGaps, 1);
  assert.ok(result.gaps[0].gapDays > 30);
}

// Experienced not currently working → trailing gap to today
{
  const result = computeTimelineCareerGaps({
    activities: [{ id: 'a', startDate: '2024-01-01', endDate: '2025-01-01' }],
    now: d('2026-09-22'),
  });
  assert.equal(result.totalGaps, 1);
  assert.ok(result.gaps[0].gapDays > 30);
  assert.equal(result.gaps[0].gapEndDate, '2026-09-22');
}

{
  const merged = mergeActivityRanges([
    { id: 'a', start: d('2022-01-01'), end: d('2023-12-01') },
    { id: 'b', start: d('2023-06-01'), end: d('2024-02-01') },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(toIso(merged[0].end), '2024-02-01');
}

assert.equal(formatGapDurationFromDays(31), '1 month 1 day');
assert.equal(formatGapDurationFromDays(45), '1 month 15 days');

console.log('career-timeline-gaps tests passed');
