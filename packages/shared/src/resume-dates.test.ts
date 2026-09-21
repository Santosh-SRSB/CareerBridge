import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatResumeDate,
  formatResumeDateRange,
  parseResumeDate,
  toMonthInputValue,
} from './resume-dates';

describe('resume date precision', () => {
  it('formats full day dates', () => {
    assert.equal(formatResumeDate('23 September 2026'), '23 SEP 2026');
    assert.equal(formatResumeDate('23/09/2026'), '23 SEP 2026');
    assert.equal(formatResumeDate('2026-09-23'), '23 SEP 2026');
  });

  it('does not invent day for month-only', () => {
    assert.equal(parseResumeDate('Jan 2024')?.precision, 'month');
    assert.equal(formatResumeDate('Jan 2024'), 'JAN 2024');
    assert.equal(toMonthInputValue('Jan 2024'), '2024-01');
  });

  it('keeps year-only', () => {
    assert.equal(formatResumeDate('2024'), '2024');
    assert.equal(toMonthInputValue('2024'), '');
  });

  it('formats current ranges as PRESENT', () => {
    assert.equal(formatResumeDateRange('2024-09-23', null, true), '23 SEP 2024 – PRESENT');
    assert.equal(formatResumeDateRange('2024-01', null, true), 'JAN 2024 – PRESENT');
  });
});
