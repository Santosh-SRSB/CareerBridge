'use client';

import { useRef, useState } from 'react';
import { downloadAdminReport } from '@/lib/api';
import {
  ADMIN_REPORT_EXPORTS,
  type AdminReportKind,
  createSingleFlight,
  reportExportFailureText,
} from '@/lib/admin-report-export';
import { ActionBtn } from './admin-tab-ui';

const KINDS: AdminReportKind[] = ['employers', 'candidates'];

export function ReportExportPanel() {
  const flight = useRef(createSingleFlight<AdminReportKind>()).current;
  const [running, setRunning] = useState<Partial<Record<AdminReportKind, boolean>>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function download(kind: AdminReportKind) {
    if (flight.isRunning(kind)) return;
    setMessage(null);
    setRunning((r) => ({ ...r, [kind]: true }));
    try {
      const fileName = await flight.run(kind, () => downloadAdminReport(kind));
      setMessage({ tone: 'ok', text: `Downloaded ${fileName}` });
    } catch (err) {
      setMessage({ tone: 'error', text: reportExportFailureText(err) });
    } finally {
      setRunning((r) => ({ ...r, [kind]: false }));
    }
  }

  return (
    <div className="border border-[#ddd] bg-white shadow-sm" style={{ borderTop: '5px solid #1f9d68' }} data-testid="report-export-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1f9d68]">Excel reports</h2>
          <p className="text-xs text-[#888]">Summary metrics plus every employer or candidate record (.xlsx).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => (
            <ActionBtn key={kind} accent="#1f9d68" disabled={Boolean(running[kind])} onClick={() => void download(kind)}>
              {running[kind] ? 'Preparing…' : ADMIN_REPORT_EXPORTS[kind].label}
            </ActionBtn>
          ))}
        </div>
      </div>
      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`border-t border-[#eee] px-4 py-2 text-xs font-semibold ${
            message.tone === 'error' ? 'text-[#b93c1c]' : 'text-[#1e7a50]'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
