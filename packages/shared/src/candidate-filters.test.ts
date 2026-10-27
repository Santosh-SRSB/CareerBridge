import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidatePassOutYear,
  educationRank,
  isImmediateAvailabilityAnswer,
  meetsEducationFilter,
  meetsPassOutYearFilter,
} from './candidate-filters';

test('education rank parses common Indian qualifications', () => {
  assert.equal(educationRank('B.Tech Computer Science'), 4);
  assert.equal(educationRank("Bachelor's Degree"), 4);
  assert.equal(educationRank('MBA'), 5);
  assert.equal(educationRank('Diploma in Mechanical'), 3);
  assert.equal(educationRank('12th / Higher Secondary'), 2);
  assert.equal(educationRank('10th / Secondary'), 1);
  assert.equal(educationRank(''), 0);
});

test('"Any Graduate" accepts graduates and postgraduates only', () => {
  assert.equal(meetsEducationFilter('B.Com', 'graduate'), true);
  assert.equal(meetsEducationFilter('M.Sc Physics', 'graduate'), true);
  assert.equal(meetsEducationFilter('12th', 'graduate'), false);
  assert.equal(meetsEducationFilter(null, 'graduate'), false);
  assert.equal(meetsEducationFilter(null, 'any'), true);
  assert.equal(meetsEducationFilter(null, ''), true);
});

test('pass-out year uses latest education yearCompleted or educationEnd', () => {
  assert.equal(candidatePassOutYear({ education: [{ yearCompleted: 2018 }, { yearCompleted: 2021 }] }), 2021);
  assert.equal(candidatePassOutYear({ educationEnd: '2020-06' }), 2020);
  assert.equal(candidatePassOutYear({ educationEnd: '2020-06', education: [{ yearCompleted: 2019 }] }), 2020);
  assert.equal(candidatePassOutYear({}), null);
  assert.equal(meetsPassOutYearFilter(2021, 2021), true);
  assert.equal(meetsPassOutYearFilter(2021, 2020), false);
  assert.equal(meetsPassOutYearFilter(null, undefined), true);
  assert.equal(meetsPassOutYearFilter(2021, ''), true);
});

test('pass-out year range includes every year between from and to', () => {
  assert.equal(meetsPassOutYearFilter(2018, undefined, { from: 2018, to: 2025 }), true);
  assert.equal(meetsPassOutYearFilter(2019, undefined, { from: 2018, to: 2025 }), true);
  assert.equal(meetsPassOutYearFilter(2020, undefined, { from: 2018, to: 2025 }), true);
  assert.equal(meetsPassOutYearFilter(2025, undefined, { from: 2018, to: 2025 }), true);
  assert.equal(meetsPassOutYearFilter(2017, undefined, { from: 2018, to: 2025 }), false);
  assert.equal(meetsPassOutYearFilter(2026, undefined, { from: 2018, to: 2025 }), false);
  assert.equal(meetsPassOutYearFilter(2020, undefined, { from: 2018 }), true);
  assert.equal(meetsPassOutYearFilter(2017, undefined, { from: 2018 }), false);
  assert.equal(meetsPassOutYearFilter(2020, undefined, { to: 2020 }), true);
  assert.equal(meetsPassOutYearFilter(2021, undefined, { to: 2020 }), false);
  assert.equal(meetsPassOutYearFilter(null, undefined, { from: 2018, to: 2025 }), false);
  assert.equal(meetsPassOutYearFilter(2020, undefined, {}), true);
});

test('immediate availability does not match notice periods like 30 days', () => {
  assert.equal(isImmediateAvailabilityAnswer('Immediate'), true);
  assert.equal(isImmediateAvailabilityAnswer('asap'), true);
  assert.equal(isImmediateAvailabilityAnswer('0 days'), true);
  assert.equal(isImmediateAvailabilityAnswer('0'), true);
  assert.equal(isImmediateAvailabilityAnswer('available now'), true);
  assert.equal(isImmediateAvailabilityAnswer('30 days'), false);
  assert.equal(isImmediateAvailabilityAnswer('15 days'), false);
  assert.equal(isImmediateAvailabilityAnswer('10 days'), false);
  assert.equal(isImmediateAvailabilityAnswer('2 months'), false);
  assert.equal(isImmediateAvailabilityAnswer('Notice TBD'), false);
});
