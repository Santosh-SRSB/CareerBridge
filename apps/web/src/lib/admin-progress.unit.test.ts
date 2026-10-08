import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type AdminProgressReport,
  type AdminProgressStage,
  PROGRESS_PIE_COLORS,
  buildProgressPie,
  hasProgressData,
  progressCaption,
  progressPieSummary,
  progressShareLabel,
  progressViewState,
} from './admin-progress';

const CANDIDATE_STAGES = [
  ['ONBOARDED', 'Candidate Onboarded'],
  ['MOCK_INTERVIEW', 'Took Mock Interview'],
  ['APPLIED', 'Applied for Job'],
  ['SHORTLISTED', 'Shortlisted'],
  ['INTERVIEWED', 'Interviewed'],
  ['FINAL_SHORTLISTED', 'Shortlisted (Final)'],
  ['JOINED', 'Joined'],
] as const;

const EMPLOYER_STAGES = [
  ['ONBOARDED', 'Employer Onboarded'],
  ['REQUIREMENTS_POSTED', 'Requirements Posted'],
  ['INTERVIEW_HAPPENED', 'Interview Happened'],
  ['SELECTION_DONE', 'Selection Done'],
  ['CANDIDATES_ONBOARDED', 'Candidates Onboarded'],
] as const;

function stages(defs: readonly (readonly [string, string])[], counts: number[]): AdminProgressStage[] {
  return defs.map(([key, label], i) => ({
    key,
    label,
    count: counts[i]!,
    percentOfRegistered: null,
    definition: `${label} definition`,
  }));
}

function report(defs: readonly (readonly [string, string])[], counts: number[]): AdminProgressReport {
  return { generatedAt: '2026-10-08T00:00:00.000Z', registered: 120, stages: stages(defs, counts) };
}

test('share label handles an empty population', () => {
  assert.equal(progressShareLabel({ percentOfRegistered: null }, 'candidates'), 'No candidates registered yet');
  assert.equal(progressShareLabel({ percentOfRegistered: 0 }, 'employers'), '0% of registered employers');
  assert.equal(progressShareLabel({ percentOfRegistered: 37.5 }, 'candidates'), '37.5% of registered candidates');
});

test('caption states the registered total and the counting rule', () => {
  assert.equal(
    progressCaption({ registered: 12 }, 'employers'),
    '12 registered employers · each counted once per stage',
  );
  assert.equal(progressCaption({ registered: 0 }, 'candidates'), '0 registered candidates · each counted once per stage');
});

test('candidate pie keeps the 7 backend stages, labels, order and raw counts', () => {
  const counts = [100, 70, 55, 30, 20, 10, 6];
  const pie = buildProgressPie(stages(CANDIDATE_STAGES, counts));
  assert.deepEqual(
    pie.slices.map((s) => [s.key, s.label, s.count]),
    CANDIDATE_STAGES.map(([key, label], i) => [key, label, counts[i]]),
  );
  assert.equal(pie.total, 291);
  assert.deepEqual(
    pie.slices.map((s) => s.share),
    [34.4, 24.1, 18.9, 10.3, 6.9, 3.4, 2.1],
  );
});

test('employer pie keeps the 5 backend stages, labels, order and raw counts', () => {
  const counts = [12, 9, 5, 3, 2];
  const pie = buildProgressPie(stages(EMPLOYER_STAGES, counts));
  assert.deepEqual(
    pie.slices.map((s) => [s.label, s.count]),
    EMPLOYER_STAGES.map(([, label], i) => [label, counts[i]]),
  );
  assert.equal(pie.total, 31);
});

test('slice angles are proportional to the backend counts and start at 12 o\'clock', () => {
  const pie = buildProgressPie(stages(EMPLOYER_STAGES, [1, 1, 1, 1, 0]));
  // Four equal quarters of a circle centred at (100,100) with radius 96, clockwise from the top.
  assert.deepEqual(
    pie.slices.slice(0, 4).map((s) => s.path),
    [
      'M 100 100 L 100 4 A 96 96 0 0 1 196 100 Z',
      'M 100 100 L 196 100 A 96 96 0 0 1 100 196 Z',
      'M 100 100 L 100 196 A 96 96 0 0 1 4 100 Z',
      'M 100 100 L 4 100 A 96 96 0 0 1 100 4 Z',
    ],
  );
  assert.deepEqual(pie.slices.map((s) => s.share), [25, 25, 25, 25, 0]);
});

test('a slice over half the pie uses the large-arc flag', () => {
  const pie = buildProgressPie(stages(EMPLOYER_STAGES, [3, 1, 0, 0, 0]));
  assert.match(pie.slices[0]!.path!, / 0 1 1 /);
  assert.match(pie.slices[1]!.path!, / 0 0 1 /);
});

test('empty stages stay in the legend without a slice; a single stage fills the pie', () => {
  const pie = buildProgressPie(stages(EMPLOYER_STAGES, [7, 0, 0, 0, 0]));
  assert.equal(pie.slices.length, 5);
  assert.deepEqual(pie.slices.slice(1).map((s) => s.path), [null, null, null, null]);
  assert.equal(pie.slices[0]!.share, 100);
  assert.match(pie.slices[0]!.path!, /^M 4 100 A 96 96 0 1 1 196 100 A 96 96 0 1 1 4 100 Z$/);
  assert.deepEqual(pie.slices[0]!.labelPoint, { x: 100, y: 100 });
});

test('thin slices do not get an in-slice percentage label', () => {
  const pie = buildProgressPie(stages(CANDIDATE_STAGES, [100, 70, 55, 30, 20, 10, 6]));
  assert.deepEqual(
    pie.slices.map((s) => s.labelPoint !== null),
    [true, true, true, true, true, false, false],
  );
});

test('each stage gets its own colour in backend order', () => {
  const pie = buildProgressPie(stages(CANDIDATE_STAGES, [1, 1, 1, 1, 1, 1, 1]));
  assert.deepEqual(pie.slices.map((s) => s.color), [...PROGRESS_PIE_COLORS]);
  assert.equal(new Set(pie.slices.map((s) => s.color)).size, 7);
});

test('view state: loading, error, empty (no report or all zero) and ready', () => {
  const zero = report(CANDIDATE_STAGES, [0, 0, 0, 0, 0, 0, 0]);
  const some = report(CANDIDATE_STAGES, [3, 0, 1, 0, 0, 0, 0]);
  assert.equal(progressViewState({ loading: true, error: '', report: some }), 'loading');
  assert.equal(progressViewState({ loading: false, error: 'Could not load', report: null }), 'error');
  assert.equal(progressViewState({ loading: false, error: 'Could not load', report: some }), 'error');
  assert.equal(progressViewState({ loading: false, error: '', report: null }), 'empty');
  assert.equal(progressViewState({ loading: false, error: '', report: zero }), 'empty');
  assert.equal(progressViewState({ loading: false, error: '', report: { ...zero, stages: [] } }), 'empty');
  assert.equal(progressViewState({ loading: false, error: '', report: some }), 'ready');
  assert.equal(hasProgressData(zero), false);
  assert.equal(hasProgressData(some), true);
});

test('accessible summary lists every stage with its backend count', () => {
  assert.equal(
    progressPieSummary('Employer Progress', stages(EMPLOYER_STAGES, [12, 9, 5, 3, 2])),
    'Employer Progress pie chart: Employer Onboarded 12, Requirements Posted 9, Interview Happened 5, Selection Done 3, Candidates Onboarded 2',
  );
});
