import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOpenAdminTab } from './admin-portal';
import {
  ADMIN_REPORT_EXPORTS,
  createSingleFlight,
  fetchAdminReport,
  reportExportErrorMessage,
  reportExportFailureText,
  reportFileNameFromDisposition,
} from './admin-report-export';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NOW = new Date('2026-10-07T20:00:00.000Z');

function xlsxResponse(fileName: string) {
  return new Response(new Uint8Array([0x50, 0x4b, 3, 4]), {
    status: 200,
    headers: { 'content-type': XLSX, 'content-disposition': `attachment; filename="${fileName}"` },
  });
}
function jsonError(status: number, message = 'Internal stack: PrismaClientKnownRequestError at db.ts:42') {
  return new Response(JSON.stringify({ success: false, error: { code: 'X', message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('buttons and endpoints for both reports', () => {
  assert.equal(ADMIN_REPORT_EXPORTS.employers.label, 'Download Employer Report');
  assert.equal(ADMIN_REPORT_EXPORTS.candidates.label, 'Download Candidate Report');
  assert.equal(ADMIN_REPORT_EXPORTS.employers.path, '/admin/reports/employers/export');
  assert.equal(ADMIN_REPORT_EXPORTS.candidates.path, '/admin/reports/candidates/export');
});

test('download buttons follow Reports tab visibility: Super Admin and Platform Admin only', () => {
  assert.equal(canOpenAdminTab('SUPER_ADMIN', 'reports'), true);
  assert.equal(canOpenAdminTab('PLATFORM_ADMIN', 'reports'), true);
  assert.equal(canOpenAdminTab('PLATFORM_OPERATOR', 'reports'), false);
  assert.equal(canOpenAdminTab('CANDIDATE', 'reports'), false);
  assert.equal(canOpenAdminTab('EMPLOYER_ADMIN', 'reports'), false);
});

test('successful download calls the right endpoint with the bearer token and keeps the server filename', async () => {
  for (const kind of ['employers', 'candidates'] as const) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const name = `careerbridge-${kind === 'employers' ? 'employer' : 'candidate'}-report-2026-10-08.xlsx`;
    const file = await fetchAdminReport(kind, {
      baseUrl: 'https://api.example/api/v1',
      token: 'access-1',
      fetch: async (url, init) => {
        calls.push({ url, init });
        return xlsxResponse(name);
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `https://api.example/api/v1${ADMIN_REPORT_EXPORTS[kind].path}`);
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer access-1');
    assert.equal(file.fileName, name);
    assert.equal(file.blob.size, 4);
  }
});

test('filename falls back to careerbridge-<kind>-report-YYYY-MM-DD.xlsx (India date) when the header is hidden', () => {
  assert.equal(reportFileNameFromDisposition(null, 'employers', NOW), 'careerbridge-employer-report-2026-10-08.xlsx');
  assert.equal(reportFileNameFromDisposition('attachment', 'candidates', NOW), 'careerbridge-candidate-report-2026-10-08.xlsx');
});

test('errors show friendly messages, never raw server text', async () => {
  for (const [status, expected] of [
    [403, /permission/],
    [429, /wait a minute/],
    [400, /Narrow the filters/],
    [500, /Could not download the report/],
  ] as const) {
    await assert.rejects(
      fetchAdminReport('employers', { baseUrl: 'https://api', token: 't', fetch: async () => jsonError(status) }),
      (err: Error & { status?: number }) => {
        assert.match(err.message, expected);
        assert.doesNotMatch(err.message, /Prisma|stack|db\.ts/);
        assert.equal(err.status, status);
        return true;
      },
    );
  }
  await assert.rejects(
    fetchAdminReport('candidates', {
      baseUrl: 'https://api',
      token: 't',
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    }),
    /Cannot reach CareerBridge/,
  );
  await assert.rejects(
    fetchAdminReport('candidates', {
      baseUrl: 'https://api',
      token: 't',
      fetch: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    }),
    /Could not download the report/,
  );
  assert.equal(reportExportErrorMessage(401), 'Your session has expired. Please sign in again.');
  assert.equal(
    reportExportFailureText(new Error('TypeError: Cannot read properties of undefined (reading x)')),
    'Could not download the report. Please try again.',
    'unexpected errors are not shown raw',
  );
});

test('401 refreshes the session once and retries; a failed refresh reports session expiry', async () => {
  const tokens: Array<string | undefined> = [];
  const file = await fetchAdminReport('employers', {
    baseUrl: 'https://api',
    token: 'stale',
    refreshToken: async () => 'fresh',
    fetch: async (_url, init) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      tokens.push(auth);
      return auth === 'Bearer fresh' ? xlsxResponse('careerbridge-employer-report-2026-10-08.xlsx') : jsonError(401);
    },
  });
  assert.deepEqual(tokens, ['Bearer stale', 'Bearer fresh']);
  assert.equal(file.fileName, 'careerbridge-employer-report-2026-10-08.xlsx');

  await assert.rejects(
    fetchAdminReport('employers', {
      baseUrl: 'https://api',
      token: 'stale',
      refreshToken: async () => null,
      fetch: async () => jsonError(401),
    }),
    /session has expired/,
  );
});

test('single-flight: a second click while the same export runs does not start another download', async () => {
  const flight = createSingleFlight<string>();
  let started = 0;
  let release!: () => void;
  const task = () => {
    started += 1;
    return new Promise<string>((resolve) => {
      release = () => resolve('done');
    });
  };
  const first = flight.run('employers', task);
  const second = flight.run('employers', task);
  assert.equal(flight.isRunning('employers'), true, 'loading state while running');
  assert.equal(flight.isRunning('candidates'), false, 'the other report stays available');
  assert.equal(started, 1);
  release();
  assert.equal(await first, 'done');
  assert.equal(await second, 'done');
  assert.equal(flight.isRunning('employers'), false, 'loading state clears after completion');
  assert.equal(await flight.run('employers', async () => 'again'), 'again', 'a later click starts a new export');
});

test('single-flight clears after a failure so the Admin can retry', async () => {
  const flight = createSingleFlight<string>();
  await assert.rejects(flight.run('candidates', async () => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(flight.isRunning('candidates'), false);
});
