'use client';

import { useEffect, useState } from 'react';
import { getAdminEmployerReport } from '@/lib/api';
import {
  type AdminEmployerReport,
  EMPLOYER_REPORT_COLUMNS,
  employerReportCaption,
  interviewStatusLines,
} from '@/lib/admin-employer-report';
import { userFacingError } from '@/lib/client-errors';

export function EmployerJobReportPanel() {
  const [data, setData] = useState<AdminEmployerReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAdminEmployerReport()
      .then((next) => active && setData(next))
      .catch((err) => active && setError(userFacingError(err, 'load the employer report')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-employer-report-title" data-testid="employer-job-report">
      <div className="sa-soft-h flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
        <h2 id="admin-employer-report-title" className="text-sm font-bold uppercase tracking-wide">
          Employer report · jobs
        </h2>
        {data ? <p className="sa-muted text-xs">{employerReportCaption(data)}</p> : null}
      </div>
      {loading ? (
        <p className="sa-muted p-4 text-sm">Loading employer report…</p>
      ) : error ? (
        <p role="alert" className="sa-error-text p-4 text-sm">
          {error}
        </p>
      ) : data && data.rows.length > 0 ? (
        <div className="max-h-[560px] overflow-auto">
          <table className="sa-table sa-table--brand min-w-[1060px] text-left text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr>
                {EMPLOYER_REPORT_COLUMNS.map((col) => (
                  <th key={col.label} scope="col" className={`px-3 py-2 ${col.numeric ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.jobId} className="align-top">
                  {EMPLOYER_REPORT_COLUMNS.map((col) => (
                    <td
                      key={col.label}
                      className={`px-3 py-2.5 ${col.numeric ? 'text-right tabular-nums' : ''} ${
                        col.label === 'Job Posted Date' || col.label === 'Closed Date' ? 'whitespace-nowrap' : ''
                      }`}
                    >
                      {col.label === 'Interview Status' ? (
                        <ul className="space-y-0.5">
                          {interviewStatusLines(row.interviewStatus).map((line) => (
                            <li key={line} className="whitespace-nowrap">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : col.label === 'Employer Name' || col.label === 'Job Name' ? (
                        <span className="font-semibold">{col.value(row)}</span>
                      ) : (
                        col.value(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sa-muted p-4 text-sm">No posted jobs yet.</p>
      )}
    </section>
  );
}
