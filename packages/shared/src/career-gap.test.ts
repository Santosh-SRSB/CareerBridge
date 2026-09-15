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

  it('flags gap only when more than 30 days', () => {
    const now = new Date(2024, 6, 15); // Jul 15
    const short = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', endDate: '2024-06' }], // ends Jun 30
      experience: [],
      now,
    });
    // Jun 30 → Jul 15 = 15 days → no gap
    assert.equal(short.hasGap, false);

    const long = computeCareerGapAfterHighestEducation({
      education: [{ qualification: 'B.Tech', endDate: '2024-05' }], // ends May 31
      experience: [],
      now,
    });
    // May 31 → Jul 15 > 30 days
    assert.equal(long.hasGap, true);
    assert.ok(long.gapLabel.includes('month'));
  });

  it('ignores gap between 12th and college when highest is degree', () => {
    const now = new Date(2024, 7, 1); // Aug 2024
    const result = computeCareerGapAfterHighestEducation({
      education: [
        { qualification: '12th', endDate: '2019-05' },
        { qualification: 'B.Com', endDate: '2024-06' },
      ],
      experience: [],
      now,
    });
    // ~1 month after B.Com (June 30 → Aug 1), not the 2019–2024 school gap
    assert.equal(result.hasGap, true);
    assert.ok(result.gapMonths >= 1 && result.gapMonths <= 3, `got ${result.gapMonths}`);
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

  it('subtracts employment after highest education', () => {
    const now = new Date(2025, 5, 1); // Jun 2025
    const result = computeCareerGapAfterHighestEducation({
      education: [
        { qualification: '12th', endDate: '2018-05' },
        { qualification: 'B.Tech', endDate: '2022-06' },
      ],
      experience: [{ startDate: '2022-07', endDate: '2025-04-01', stillInCompany: false }],
      now,
    });
    // Apr 1 → Jun 1 > 30 days
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
});
