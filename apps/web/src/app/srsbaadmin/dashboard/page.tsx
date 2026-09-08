'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminDashboard } from '@careerbridge/shared';
import { getAdminDashboard, getAdminList, logout } from '@/lib/api';
import { Logo } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { getStoredUser, isPlatformRole } from '@/lib/session';

const TABS = ['dashboard', 'candidates', 'employers', 'jobs', 'applications', 'skills', 'admins'] as const;

function cell(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export default function SrsbAdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('dashboard');
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || !isPlatformRole(user.role)) {
      router.replace('/srsbaadmin');
      return;
    }
    getAdminDashboard()
      .then(setMetrics)
      .catch(() => router.replace('/srsbaadmin'));
  }, [router]);

  useEffect(() => {
    if (tab === 'dashboard') return;
    setLoadingList(true);
    setError('');
    getAdminList(tab)
      .then((data) => setRows(Array.isArray(data) ? (data as Record<string, unknown>[]) : []))
      .catch((err) => {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Could not load data.');
      })
      .finally(() => setLoadingList(false));
  }, [tab]);

  if (!metrics) {
    return <main className="min-h-screen bg-[#f4f7f8] p-8 text-sm text-slate-500">Loading admin portal…</main>;
  }

  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).filter((key) => !['passwordHash', 'password_hash'].includes(key)).slice(0, 8)
      : [];

  return (
    <main className="min-h-screen bg-[#f4f7f8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal">Live operations</p>
              <h1 className="text-lg font-black text-[#0b1f2a]">SRSB Admin Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-[#0b1f2a]">
              Public site
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace('/srsbaadmin');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-3.5 py-2 text-xs font-extrabold capitalize ${
                tab === item ? 'bg-[#0b1f2a] text-white' : 'bg-white text-[#0b1f2a] shadow-sm'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-error">{error}</p> : null}

        {tab === 'dashboard' ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Candidates', metrics.candidates],
              ['Active candidates', metrics.activeCandidates],
              ['Employers', metrics.employers],
              ['Open jobs', metrics.openJobs],
              ['Applications', metrics.applications],
              ['Interviews', metrics.interviews],
            ].map(([label, value]) => (
              <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black text-[#0b1f2a]">{value}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loadingList ? <p className="p-6 text-sm text-slate-500">Loading {tab}…</p> : null}
            {!loadingList && rows.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No {tab} found.</p>
            ) : null}
            {!loadingList && rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-3 font-bold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={String(row.id ?? index)} className="border-t border-slate-100">
                        {columns.map((col) => (
                          <td key={col} className="max-w-[220px] truncate px-4 py-3 text-[#0b1f2a]">
                            {cell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
