import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAREER_GAP_ANALYZE_LIMITS,
  careerGapAnalyzeInput,
  computeCareerGapAfterHighestEducation,
  fitsCareerGapAnalyzeContract,
} from './career-gap';

const edu = (degree: string, endDate = '2019-06') => ({
  degree,
  startDate: '2015-07',
  endDate,
  isCurrent: false,
});
const job = { startDate: '2019-08', endDate: '2021-01', isCurrent: false };

test('analyze payload maps wizard rows to the API field names without altering values', () => {
  const longDegree = 'B.Tech '.padEnd(200, 'x');
  const input = careerGapAnalyzeInput([edu(longDegree)], [{ ...job, isCurrent: true }]);
  assert.deepEqual(input.education[0], {
    qualification: longDegree,
    startDate: '2015-07',
    endDate: '2019-06',
    isCurrent: false,
  });
  assert.deepEqual(input.experience[0], {
    startDate: '2019-08',
    endDate: '2021-01',
    stillInCompany: true,
    isCurrent: true,
  });
});

test('a qualification over the API limit is detected so the request is not sent', () => {
  const max = CAREER_GAP_ANALYZE_LIMITS.qualificationMax;
  assert.equal(fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('B.Tech')], [job])), true);
  assert.equal(fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('x'.repeat(max))], [job])), true);
  assert.equal(
    fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('B.Tech'), edu('x'.repeat(max + 1))], [job])),
    false,
  );
  assert.equal(fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('')], [job])), false);
  assert.equal(fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('B.Tech', 'x'.repeat(21))], [job])), false);
  assert.equal(
    fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([edu('B.Tech')], [{ ...job, endDate: 'x'.repeat(21) }])),
    false,
  );
  assert.equal(fitsCareerGapAnalyzeContract(careerGapAnalyzeInput([], [])), true);
});

test('local gap computation still uses the full, untruncated qualification', () => {
  const longDegree = `${'Project description '.repeat(8)}Master of Science`;
  const now = new Date(2022, 0, 1);
  const input = careerGapAnalyzeInput([edu('B.Sc', '2016-05'), edu(longDegree, '2019-06')], [job]);
  assert.equal(fitsCareerGapAnalyzeContract(input), false);
  const result = computeCareerGapAfterHighestEducation({ ...input, now });
  assert.equal(result.highestEducation?.qualification, longDegree);
  assert.equal(result.hasGap, true);
});
