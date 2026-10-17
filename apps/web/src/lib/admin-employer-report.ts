/** Admin → Reports → Employer Report: one row per posted job. Columns match the Employer Excel export. */

export type AdminEmployerJobRow = {
  jobId: string;
  employerId: string;
  employerName: string;
  jobTitle: string;
  jobStatus: string;
  jobStatusLabel: string;
  postedDate: string | null;
  candidatesApplied: number;
  candidatesShortlisted: number;
  interviewStatus: string;
  interviewStatusCounts: Record<string, number>;
  closedDate: string | null;
  daysOpen: number | null;
};

export type AdminEmployerReport = {
  generatedAt: string;
  total: number;
  limit: number;
  rows: AdminEmployerJobRow[];
};

export type EmployerReportColumn = {
  label: string;
  numeric?: boolean;
  value: (row: AdminEmployerJobRow) => string | number;
};

const dash = (value: string | number | null | undefined) => (value == null || value === '' ? '—' : value);

export const EMPLOYER_REPORT_COLUMNS: EmployerReportColumn[] = [
  { label: 'Employer Name', value: (r) => r.employerName },
  { label: 'Job Posted Date', value: (r) => dash(r.postedDate) },
  { label: 'Job Name', value: (r) => r.jobTitle },
  { label: 'Candidates Applied', numeric: true, value: (r) => r.candidatesApplied },
  { label: 'Candidates Shortlisted', numeric: true, value: (r) => r.candidatesShortlisted },
  { label: 'Interview Status', value: (r) => r.interviewStatus },
  { label: 'Closed Date', value: (r) => dash(r.closedDate) },
  { label: 'Days Requirement Open', numeric: true, value: (r) => dash(r.daysOpen) },
  { label: 'Job Status', value: (r) => r.jobStatusLabel },
];

/** "2 Interview Scheduled, 1 Selected" → one stage per line in the table. */
export function interviewStatusLines(label: string): string[] {
  return label.split(', ').filter(Boolean);
}

export function employerReportCaption(report: Pick<AdminEmployerReport, 'total' | 'rows'>): string {
  if (report.total === 0) return 'No posted jobs yet.';
  if (report.rows.length < report.total) {
    return `Showing the newest ${report.rows.length} of ${report.total} jobs. Download the Employer Report for every job.`;
  }
  return `${report.total} job${report.total === 1 ? '' : 's'}, newest posting first.`;
}
