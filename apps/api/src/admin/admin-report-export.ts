import ExcelJS from 'exceljs';
import type { EmployerJobReportRow } from './employer-job-report';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Rows fetched per query while building an export. */
export const REPORT_EXPORT_BATCH = 500;
/** Upper bound per export; the workbook is built in memory. */
export const REPORT_EXPORT_MAX_ROWS = 50_000;

export type ReportExportKind = 'employer' | 'candidate';

export type ReportColumn<T> = { header: string; width: number; value: (row: T) => string | number | Date | null };

export type ReportSheet<T = any> = { name: string; columns: ReportColumn<T>[]; rows: T[] };

export type ReportFile = { fileName: string; buffer: Buffer; rowCount: number };

const IST_OFFSET_MS = 330 * 60_000;

/** careerbridge-<kind>-report-YYYY-MM-DD.xlsx, dated in India time. */
export function reportFileName(kind: ReportExportKind, now = new Date()): string {
  const day = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return `careerbridge-${kind}-report-${day}.xlsx`;
}

export function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`;
}

/**
 * Spreadsheet apps can treat text starting with these characters as a formula once a cell is edited.
 * Phone numbers such as +91… stay as they are.
 */
function safeCell(value: string | number | Date | null | undefined): string | number | Date | null {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const formulaLike = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s()-]*$/.test(value));
  return formulaLike ? `'${value}` : value;
}

export async function buildWorkbook(sheets: ReportSheet[], now = new Date()): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CareerBridge Admin';
  workbook.created = now;
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((c) => ({ header: c.header, width: c.width }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const row of sheet.rows) ws.addRow(sheet.columns.map((c) => safeCell(c.value(row))));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export type SummaryRow = { label: string; value: string | number | null };

export const SUMMARY_COLUMNS: ReportColumn<SummaryRow>[] = [
  { header: 'Metric', width: 36, value: (r) => r.label },
  { header: 'Value', width: 40, value: (r) => r.value },
];

export type CandidateReportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  location: string;
  profileCompletion: number;
  primarySkills: string[];
  applications: number;
  resumeCount: number;
  accountStatus: string;
  createdAt: Date;
  currentPosition: string;
  mockInterviewTaken: 'Yes' | 'No';
  yearsOfExperience: number | string;
};

export const CANDIDATE_REPORT_COLUMNS: ReportColumn<CandidateReportRow>[] = [
  { header: 'Candidate Name', width: 28, value: (r) => r.name },
  { header: 'Email', width: 32, value: (r) => r.email },
  { header: 'Phone', width: 18, value: (r) => r.phone },
  { header: 'Location', width: 24, value: (r) => r.location },
  { header: 'Profile Completion (%)', width: 22, value: (r) => r.profileCompletion },
  { header: 'Primary Skills', width: 40, value: (r) => r.primarySkills.join(', ') },
  { header: 'Applications', width: 14, value: (r) => r.applications },
  { header: 'Resumes', width: 12, value: (r) => r.resumeCount },
  { header: 'Account Status', width: 16, value: (r) => r.accountStatus },
  { header: 'Registered On', width: 20, value: (r) => r.createdAt },
  { header: 'Current Position', width: 28, value: (r) => r.currentPosition },
  { header: 'Mock Interview Taken', width: 20, value: (r) => r.mockInterviewTaken },
  { header: 'Years of Experience', width: 18, value: (r) => r.yearsOfExperience },
];

/** One row per posted job; the Admin Reports Employer Report table shows the same columns. */
export const EMPLOYER_REPORT_COLUMNS: ReportColumn<EmployerJobReportRow>[] = [
  { header: 'Employer Name', width: 32, value: (r) => r.employerName },
  { header: 'Job Posted Date', width: 16, value: (r) => r.postedDate },
  { header: 'Job Name', width: 36, value: (r) => r.jobTitle },
  { header: 'Candidates Applied', width: 18, value: (r) => r.candidatesApplied },
  { header: 'Candidates Shortlisted', width: 22, value: (r) => r.candidatesShortlisted },
  { header: 'Interview Status', width: 44, value: (r) => r.interviewStatus },
  { header: 'Closed Date', width: 14, value: (r) => r.closedDate },
  { header: 'Days Requirement Open', width: 22, value: (r) => r.daysOpen },
  { header: 'Job Status', width: 16, value: (r) => r.jobStatusLabel },
];

export function filterSummary(filters: Record<string, string | undefined>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}=${String(v).trim()}`);
  return parts.length ? parts.join('; ') : 'None (all records)';
}
