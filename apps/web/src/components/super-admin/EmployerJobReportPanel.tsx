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
    <section className="border border-[#ddd] bg-white" aria-labelledby="admin-employer-report-title" data-testid="employer-job-report">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eee] bg-[#d9770614] px-4 py-3">
        <h2 id="admin-employer-report-title" className="text-sm font-bold uppercase tracking-wide text-[#a15c04]">
          Employer report · jobs
        </h2>
        {data ? <p className="text-xs text-[#666]">{employerReportCaption(data)}</p> : null}
      </div>
      {loading ? (
        <p className="p-4 text-sm text-[#666]">Loading employer report…</p>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-[#b42318]">
          {error}
        </p>
      ) : data && data.rows.length > 0 ? (
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-[1060px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#d97706] text-xs uppercase tracking-wide text-white">
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
                <tr key={row.jobId} className="border-t border-[#f3e7d6] align-top">
                  {EMPLOYER_REPORT_COLUMNS.map((col) => (
                    <td key={col.label} className={`px-3 py-2.5 ${col.numeric ? 'text-right tabular-nums' : ''}`}>
                      {col.label === 'Interview Status' ? (
                        <ul className="space-y-0.5">
                          {interviewStatusLines(row.interviewStatus).map((line) => (
                            <li key={line} className="whitespace-nowrap">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : col.label === 'Employer Name' || col.label === 'Job Name' ? (
                        <span className="font-semibold text-[#333]">{col.value(row)}</span>
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
        <p className="p-4 text-sm text-[#666]">No posted jobs yet.</p>
      )}
    </section>
  );
}
