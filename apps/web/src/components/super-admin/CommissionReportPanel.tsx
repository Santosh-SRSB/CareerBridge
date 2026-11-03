'use client';

import { FormEvent, useEffect, useState } from 'react';
import { addAdminCommission, getAdminCommissionReport, getAdminList, type AdminCommissionReport } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';

type ApplicationRow = {
  id: string;
  status?: string;
  candidateName?: string;
  jobTitle?: string;
  companyName?: string;
  opportunityType?: string;
  commissionPercent?: number | null;
  canAddCommission?: boolean;
};

export function CommissionReportPanel() {
  const [report, setReport] = useState<AdminCommissionReport | null>(null);
  const [selectedApps, setSelectedApps] = useState<ApplicationRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [percentDraft, setPercentDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [commission, applications] = await Promise.all([
        getAdminCommissionReport(),
        getAdminList('applications').catch(() => [] as ApplicationRow[]),
      ]);
      setReport(commission);
      const rows = Array.isArray(applications) ? (applications as ApplicationRow[]) : [];
      setSelectedApps(
        rows.filter(
          (row) =>
            row.canAddCommission ||
            row.commissionPercent != null ||
            row.status === 'SELECTED' ||
            row.status === 'HIRED',
        ),
      );
    } catch (err) {
      setError(userFacingError(err, 'load commission report'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onAddCommission(event: FormEvent, applicationId: string) {
    event.preventDefault();
    const percent = Number(percentDraft);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setError('Enter a commission percentage between 0.01 and 100');
      return;
    }
    setSavingId(applicationId);
    setError('');
    try {
      await addAdminCommission(applicationId, percent);
      setOpenId(null);
      setPercentDraft('');
      await reload();
    } catch (err) {
      setError(userFacingError(err, 'add commission'));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-commission-report-title">
      <div className="border-b border-[var(--sa-line)] px-4 py-3">
        <h2 id="admin-commission-report-title" className="text-sm font-bold uppercase tracking-wide">
          Training commission
        </h2>
        <p className="sa-muted mt-1 text-xs">
          After a candidate is Selected, Super Admin / Admin can add a commission percentage. The
          report below lists only saved commission records.
        </p>
      </div>

      {error ? <p className="px-4 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="sa-muted px-4 py-3 text-sm">Loading…</p> : null}

      {!loading ? (
        <div className="space-y-4 px-4 py-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide">Selected — add commission</h3>
            {selectedApps.filter((row) => row.canAddCommission).length === 0 ? (
              <p className="sa-muted mt-2 text-sm">No selected applications waiting for commission.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedApps
                  .filter((row) => row.canAddCommission)
                  .map((row) => (
                    <li key={row.id} className="rounded-lg border border-[var(--sa-line)] p-3">
                      <p className="font-bold">{row.candidateName || '—'}</p>
                      <p className="sa-muted text-xs">
                        {row.jobTitle} · {row.companyName}
                        {row.opportunityType === 'INTERNSHIP_TRAINING' ? ' · Training' : ''}
                      </p>
                      {openId === row.id ? (
                        <form
                          className="mt-3 flex flex-wrap items-end gap-2"
                          onSubmit={(event) => void onAddCommission(event, row.id)}
                        >
                          <label className="text-xs font-bold">
                            Commission
                            <span className="mt-1 flex items-center overflow-hidden rounded-md border border-[var(--sa-line)] bg-white">
                              <input
                                inputMode="decimal"
                                placeholder="10"
                                value={percentDraft}
                                onChange={(event) =>
                                  setPercentDraft(event.target.value.replace(/[^\d.]/g, ''))
                                }
                                className="w-20 px-2 py-1.5 text-sm outline-none"
                                aria-label="Commission percent"
                              />
                              <span className="border-l border-[var(--sa-line)] bg-slate-50 px-2 py-1.5 text-sm font-bold text-slate-600">
                                %
                              </span>
                            </span>
                          </label>
                          <button
                            type="submit"
                            disabled={savingId === row.id}
                            className="rounded-md bg-[#0b1f4d] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            {savingId === row.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[var(--sa-line)] px-3 py-1.5 text-xs font-bold"
                            onClick={() => {
                              setOpenId(null);
                              setPercentDraft('');
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 rounded-md bg-[#0b1f4d] px-3 py-1.5 text-xs font-bold text-white"
                          onClick={() => {
                            setOpenId(row.id);
                            setPercentDraft('');
                          }}
                        >
                          Add Commission
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide">
              Commission report ({report?.total ?? 0})
            </h3>
            {!report?.rows.length ? (
              <p className="sa-muted mt-2 text-sm">No commission records yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--sa-line)] text-[10px] uppercase tracking-wide">
                      <th className="py-2 pr-3">Candidate</th>
                      <th className="py-2 pr-3">Programme</th>
                      <th className="py-2 pr-3">Selected</th>
                      <th className="py-2 pr-3">Commission</th>
                      <th className="py-2">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--sa-line)]/60">
                        <td className="py-2 pr-3 font-semibold">{row.candidateName}</td>
                        <td className="py-2 pr-3">
                          {row.programmeTitle}
                          <div className="sa-muted">{row.companyName}</div>
                        </td>
                        <td className="py-2 pr-3">
                          {new Date(row.selectedAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 pr-3 font-bold">{row.commissionPercent}%</td>
                        <td className="py-2">{row.invoiceStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
