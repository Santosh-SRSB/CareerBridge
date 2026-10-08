import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type AdminEmployerJobRow,
  EMPLOYER_REPORT_COLUMNS,
  employerReportCaption,
  interviewStatusLines,
} from './admin-employer-report';

const row: AdminEmployerJobRow = {
  jobId: 'j1',
  employerId: 'e1',
  employerName: 'Employer A',
  jobTitle: 'Java Developer',
  jobStatus: 'PUBLISHED',
  jobStatusLabel: 'Active',
  postedDate: '2026-10-01',
  candidatesApplied: 0,
  candidatesShortlisted: 0,
  interviewStatus: 'No Interview',
  interviewStatusCounts: {},
  closedDate: null,
  daysOpen: 6,
};

const valueOf = (r: AdminEmployerJobRow, label: string) => EMPLOYER_REPORT_COLUMNS.find((c) => c.label === label)!.value(r);

test('table columns are the stakeholder columns, in order, matching the Excel headers', () => {
  assert.deepEqual(
    EMPLOYER_REPORT_COLUMNS.map((c) => c.label),
    [
      'Employer Name',
      'Job Posted Date',
      'Job Name',
      'Candidates Applied',
      'Candidates Shortlisted',
      'Interview Status',
      'Closed Date',
      'Days Requirement Open',
      'Job Status',
    ],
  );
});

test('a job with no applications renders 0 | 0 | No Interview with its days open', () => {
  assert.deepEqual(EMPLOYER_REPORT_COLUMNS.map((c) => c.value(row)), [
    'Employer A',
    '2026-10-01',
    'Java Developer',
    0,
    0,
    'No Interview',
    '—',
    6,
    'Active',
  ]);
});

test('an open job shows a dash for Closed Date and its days open to today', () => {
  const open = { ...row, postedDate: '2026-09-30', daysOpen: 8 };
  assert.equal(valueOf(open, 'Closed Date'), '—');
  assert.equal(valueOf(open, 'Days Requirement Open'), 8);
  assert.equal(valueOf(open, 'Job Status'), 'Active');
});

test('a closed job shows its closed date and the days from posting to closing', () => {
  const closed = {
    ...row,
    jobStatus: 'CLOSED',
    jobStatusLabel: 'Closed',
    postedDate: '2026-09-28',
    closedDate: '2026-10-02',
    daysOpen: 4,
  };
  assert.deepEqual(EMPLOYER_REPORT_COLUMNS.slice(6).map((c) => c.value(closed)), ['2026-10-02', 4, 'Closed']);
  const sameDay = { ...closed, postedDate: '2026-09-30', closedDate: '2026-09-30', daysOpen: 0 };
  assert.equal(valueOf(sameDay, 'Closed Date'), '2026-09-30');
  assert.equal(valueOf(sameDay, 'Days Requirement Open'), 0, 'zero days stays numeric');
});

test('a legacy closed job with no recorded close shows dashes, never "null"', () => {
  const legacy = { ...row, jobStatus: 'CLOSED', jobStatusLabel: 'Closed', closedDate: null, daysOpen: null };
  assert.deepEqual(EMPLOYER_REPORT_COLUMNS.slice(6).map((c) => c.value(legacy)), ['—', '—', 'Closed']);
});

test('missing posted date or days open shows a dash, never "null"', () => {
  const values = EMPLOYER_REPORT_COLUMNS.map((c) => c.value({ ...row, postedDate: null, daysOpen: null }));
  assert.equal(values[1], '—');
  assert.equal(values[7], '—');
  assert.equal(values[3], 0, 'zero counts stay numeric');
});

test('interview summary splits into one line per stage', () => {
  assert.deepEqual(interviewStatusLines('2 Interview Scheduled, 1 Feedback Pending, 1 Selected'), [
    '2 Interview Scheduled',
    '1 Feedback Pending',
    '1 Selected',
  ]);
  assert.deepEqual(interviewStatusLines('No Interview'), ['No Interview']);
});

test('caption explains empty, complete and truncated tables', () => {
  assert.equal(employerReportCaption({ total: 0, rows: [] }), 'No posted jobs yet.');
  assert.equal(employerReportCaption({ total: 1, rows: [row] }), '1 job, newest posting first.');
  assert.equal(
    employerReportCaption({ total: 750, rows: Array(500).fill(row) }),
    'Showing the newest 500 of 750 jobs. Download the Employer Report for every job.',
  );
});
