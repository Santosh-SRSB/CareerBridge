import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidatePassOutYear,
  educationRank,
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
