import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeCareerGapAfterHighestEducation,
  educationQualificationRank,
  formatCareerGapLabel,
  pickHighestEducation,
} from './career-gap.js';

describe('career-gap after highest education', () => {
  it('ranks postgraduate above 12th and graduate', () => {
    assert.ok(educationQualificationRank('12th') < educationQualificationRank('B.Tech'));
    assert.ok(educationQualificationRank('B.Tech') < educationQualificationRank('M.Tech'));
    assert.ok(educationQualificationRank('10th') < educationQualificationRank('Diploma'));
  });

  it('picks degree over 12th even if 12th ended later in the list order', () => {
    const highest = pickHighestEducation([
      { qualification: '12th', endDate: '2020-05' },
      { qualification: 'B.Tech Computer Science', endDate: '2024-06' },
    ]);
    assert.equal(highest?.qualification, 'B.Tech Computer Science');
    assert.equal(highest?.endDate, '2024-06-30');
  });

  it('formats years and months with and', () => {
    assert.equal(formatCareerGapLabel(13), '1 year and 1 month');
    assert.equal(formatCareerGapLabel(24), '2 years');
    assert.equal(formatCareerGapLabel(2), '2 months');
  });

  it('does not flag fresher period before first job as a career gap', () => {
    const now = new Date(2024, 6, 15); // Jul 15
    const fresher = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', endDate: '2024-05' }],
      experience: [],
      now,
    });
    assert.equal(fresher.hasGap, false);
    assert.equal(fresher.gapMonths, 0);
  });

  it('ignores school→college and fresher time when continuously employed later', () => {
    const now = new Date(2025, 5, 1); // Jun 2025
    const result = computeCareerGapAfterHighestEducation({
      education: [
        { qualification: '12th', endDate: '2019-05' },
        { qualification: 'B.Com', endDate: '2022-06' },
      ],
      experience: [{ startDate: '2023-01', isCurrent: true }],
      now,
    });
    // First job Jan 2023 → now, continuous → no employment break
    assert.equal(result.hasGap, false);
    assert.equal(result.highestEducation?.qualification, 'B.Com');
  });

  it('does not flag gap while still studying highest education', () => {
    const result = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', startDate: '2022-08', isCurrent: true }],
      experience: [],
      now: new Date(2025, 0, 1),
    });
    assert.equal(result.hasGap, false);
    assert.equal(result.gapMonths, 0);
  });

  it('flags break between jobs after first employment', () => {
    const now = new Date(2025, 5, 1); // Jun 2025
    const result = computeCareerGapAfterHighestEducation({
      education: [
        { qualification: '12th', endDate: '2018-05' },
        { qualification: 'B.Tech', endDate: '2022-06' },
      ],
      experience: [
        { startDate: '2022-07', endDate: '2023-06', stillInCompany: false },
        { startDate: '2024-08', endDate: '2025-04-01', stillInCompany: false },
      ],
      now,
    });
    // Gap mid 2023 → Aug 2024, plus Apr→Jun 2025 after last job
    assert.equal(result.hasGap, true);
    assert.ok(result.gapMonths >= 1, `got ${result.gapMonths}`);
  });

  it('no gap when continuously employed after degree', () => {
    const now = new Date(2025, 5, 1);
    const result = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', endDate: '2022-06' }],
      experience: [{ startDate: '2022-07', isCurrent: true }],
      now,
    });
    assert.equal(result.hasGap, false);
    assert.equal(result.gapMonths, 0);
  });

  it('treats open-ended job and ISO datetimes as covering the gap', () => {
    const now = new Date(2026, 8, 19);
    const result = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', endDate: '2021-06-30' }],
      experience: [
        {
          startDate: '2021-07-01T00:00:00.000Z',
          endDate: '',
          stillInCompany: true,
        },
      ],
      now,
    });
    assert.equal(result.hasGap, false);
    assert.equal(result.gapMonths, 0);
  });

  it('no gap for late first job if still continuously employed', () => {
    const now = new Date(2026, 8, 19);
    const result = computeCareerGapAfterHighestEducation({
      education: [
        { qualification: '10th', endDate: '2016-06-01' },
        { qualification: 'Maharana Pratap Engineering College, Kanpur', endDate: '2021-06-30' },
      ],
      experience: [{ startDate: '2023-01-15', isCurrent: true }],
      now,
    });
    assert.equal(result.hasGap, false);
    assert.equal(result.gapMonths, 0);
  });

  it('ranks school names below engineering college free-text', () => {
    assert.ok(
      educationQualificationRank('Sarvoday High School Bhagwanpur') <
        educationQualificationRank('Maharana Pratap Engineering College, Kanpur'),
    );
    assert.equal(educationQualificationRank('Other (specify)'), 5);
  });
});
