/** Admin Reports → Excel downloads (Super Admin / Platform Admin, same as the Reports tab). */
export type AdminReportKind = 'employers' | 'candidates';

export const ADMIN_REPORT_EXPORTS: Record<AdminReportKind, { label: string; path: string; filePrefix: string }> = {
  employers: {
    label: 'Download Employer Report',
    path: '/admin/reports/employers/export',
    filePrefix: 'careerbridge-employer-report',
  },
  candidates: {
    label: 'Download Candidate Report',
    path: '/admin/reports/candidates/export',
    filePrefix: 'careerbridge-candidate-report',
  },
};

const IST_OFFSET_MS = 330 * 60_000;
const NETWORK_MESSAGE = 'Cannot reach CareerBridge right now. Check your connection and try again.';

export function reportFileNameFromDisposition(header: string | null, kind: AdminReportKind, now = new Date()): string {
  const match = header ? /filename="?([^";]+\.xlsx)"?/i.exec(header) : null;
  if (match) return match[1]!;
  const day = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return `${ADMIN_REPORT_EXPORTS[kind].filePrefix}-${day}.xlsx`;
}

/** Admin-facing message for a failed export; never the raw server text. */
export function reportExportErrorMessage(status?: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to download this report.';
  if (status === 429) return 'Too many downloads in a short time. Please wait a minute and try again.';
  if (status === 400) return 'This report could not be generated for the current filters. Narrow the filters and try again.';
  return 'Could not download the report. Please try again.';
}

export type ReportExportError = Error & { status?: number };

function exportError(message: string, status?: number): ReportExportError {
  const error = new Error(message) as ReportExportError;
  error.name = 'ReportExportError';
  error.status = status;
  return error;
}

/** The message to show the Admin for any error thrown while exporting. */
export function reportExportFailureText(err: unknown): string {
  if (err instanceof Error && err.name === 'ReportExportError') return err.message;
  return reportExportErrorMessage((err as { status?: number } | null)?.status);
}

export type ReportFetchDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  baseUrl: string;
  token: string | null;
  /** Called once on 401; returns a fresh access token, or null when the session cannot be refreshed. */
  refreshToken?: () => Promise<string | null>;
};

export async function fetchAdminReport(
  kind: AdminReportKind,
  deps: ReportFetchDeps,
  now = new Date(),
): Promise<{ blob: Blob; fileName: string }> {
  if (!deps.baseUrl) throw exportError(NETWORK_MESSAGE);
  const url = `${deps.baseUrl}${ADMIN_REPORT_EXPORTS[kind].path}`;
  const call = async (token: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await deps.fetch(url, { method: 'GET', headers });
    } catch {
      throw exportError(NETWORK_MESSAGE);
    }
  };

  let response = await call(deps.token);
  if (response.status === 401 && deps.refreshToken) {
    const fresh = await deps.refreshToken();
    if (fresh) response = await call(fresh);
  }
  if (!response.ok) throw exportError(reportExportErrorMessage(response.status), response.status);
  if (!/spreadsheetml/i.test(response.headers.get('content-type') || '')) {
    throw exportError(reportExportErrorMessage(), response.status);
  }
  const blob = await response.blob();
  return { blob, fileName: reportFileNameFromDisposition(response.headers.get('content-disposition'), kind, now) };
}

/** Runs at most one task per key; a second call while one is running gets the same promise. */
export function createSingleFlight<K>() {
  const running = new Map<K, Promise<unknown>>();
  return {
    isRunning: (key: K) => running.has(key),
    run<T>(key: K, task: () => Promise<T>): Promise<T> {
      const existing = running.get(key);
      if (existing) return existing as Promise<T>;
      const promise = task().finally(() => running.delete(key));
      running.set(key, promise);
      return promise;
    },
  };
}

export function saveBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
