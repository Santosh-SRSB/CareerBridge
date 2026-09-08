'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ResumeRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { ResumeAtsTopSwitcher } from '@/components/ResumeAtsTopSwitcher';
import { deleteResume, listResumes } from '@/lib/api';
import { startResumeUpdate } from '@/features/resume/resume-update-mode';
import { markResumeBuildPath } from '@/features/resume/resume-wizard-draft';

function versionLabel(row: ResumeRecord) {
  const kind =
    row.kind === 'OPTIMIZED'
      ? 'AI Improved'
      : row.parentResumeId
        ? 'Edited'
        : 'Original';
  return `V${row.version} · ${kind}`;
}

export default function ViewResumesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ResumeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listResumes();
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load resumes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onEdit(row: ResumeRecord) {
    startResumeUpdate(row.id);
    router.push('/resume');
  }

  function onCheckAts(row: ResumeRecord) {
    router.push(`/ats?resumeId=${encodeURIComponent(row.id)}`);
  }

  function onAddNew() {
    markResumeBuildPath();
    router.push('/resume?from=build');
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setToast('');
    try {
      const result = (await deleteResume(pendingDelete.id)) as {
        deleted?: boolean;
        archived?: boolean;
      };
      if (result.archived) {
        setToast('Resume archived — it stays linked to past applications.');
      } else {
        setToast('Resume deleted.');
      }
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete resume.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CandidateAppShell activeTab="resumes" title="View Resume">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <ResumeAtsTopSwitcher active="resumes" />
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Your resumes</h1>
            <p className="mt-1 text-sm text-slate-600">
              Each save creates a new version (V1, V2…). Profile stays independent of any single
              resume.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNew}
            className="rounded-xl bg-[#0a2e2c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#072422]"
          >
            Add new resume
          </button>
        </div>

        {toast ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {toast}
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading resumes…</p>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No resumes yet.</p>
            <p className="mt-1 text-sm text-slate-500">Build one or upload, then check ATS score.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onAddNew}
                className="rounded-xl bg-[#0a2e2c] px-4 py-2.5 text-sm font-bold text-white"
              >
                Build resume
              </button>
              <Link
                href="/onboarding/complete"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Autofill upload
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900">{row.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {versionLabel(row)}
                      {row.score ? ` · Score ${row.score}` : ''}
                      {row.applicationCount
                        ? ` · Used in ${row.applicationCount} application${row.applicationCount === 1 ? '' : 's'}`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Updated {new Date(row.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onCheckAts(row)}
                      className="rounded-lg bg-[#0a2e2c] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#072422]"
                    >
                      Check ATS
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(row)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-slate-900">Delete this resume?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {pendingDelete.applicationCount
                ? `“${pendingDelete.title}” is linked to applications, so it will be archived (not permanently removed) to keep job history.`
                : `“${pendingDelete.title}” will be removed from your list and cloud storage.`}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold"
              >
                No, cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {deleting ? 'Working…' : 'Yes, continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CandidateAppShell>
  );
}
