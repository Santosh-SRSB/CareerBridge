'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResumeRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import {
  deleteResume,
  getResumeProcessingStatus,
  getResumeViewUrl,
  listResumes,
  retryResumeProcessing,
  uploadResumeFile,
} from '@/lib/api';
import { startResumeUpdate } from '@/features/resume/resume-update-mode';
import { rememberReturnTo } from '@/lib/nav-return';

const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

function versionLabel(row: ResumeRecord) {
  const kind =
    row.kind === 'OPTIMIZED'
      ? 'AI Improved'
      : row.parentResumeId
        ? 'Edited'
        : 'Original';
  return `V${row.version} · ${kind}`;
}

function CloudResumePreview({
  url,
  mimeType,
  fileName,
  onClose,
  onRetry,
}: {
  url: string;
  mimeType: string;
  fileName: string;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const isPdf = /pdf/i.test(mimeType) || /\.pdf$/i.test(fileName);
  return (
    <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <p className="truncate text-xs font-semibold text-slate-600">{fileName}</p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-2 py-1 text-xs font-bold text-[#0a2e2c] hover:bg-[#0a2e2c]/8"
          >
            Open
          </a>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Reload
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Close resume preview"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {isPdf ? (
        <iframe title={fileName} src={url} className="h-[min(70vh,720px)] w-full bg-white" />
      ) : (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-slate-600">Preview is available for PDF files.</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-xl bg-[#0a2e2c] px-5 py-2.5 text-sm font-bold text-white"
          >
            Open file from Cloud Storage
          </a>
        </div>
      )}
    </div>
  );
}

export default function ViewResumesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ResumeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [failedResumeId, setFailedResumeId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewMeta, setViewMeta] = useState<{ fileName: string; mimeType: string } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

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

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  function closePreview() {
    setViewingId(null);
    setViewUrl(null);
    setViewMeta(null);
    setViewError('');
    setViewLoading(false);
  }

  async function loadCloudView(resumeId: string) {
    setViewLoading(true);
    setViewError('');
    try {
      const result = await getResumeViewUrl(resumeId);
      setViewUrl(result.url);
      setViewMeta({ fileName: result.fileName, mimeType: result.mimeType });
    } catch (err) {
      setViewUrl(null);
      setViewMeta(null);
      setViewError(err instanceof Error ? err.message : 'Could not load resume from Cloud Storage.');
    } finally {
      setViewLoading(false);
    }
  }

  async function onViewResume(row: ResumeRecord) {
    if (viewingId === row.id) {
      closePreview();
      return;
    }
    setViewingId(row.id);
    setViewUrl(null);
    setViewMeta(null);
    await loadCloudView(row.id);
  }

  function onEdit(row: ResumeRecord) {
    startResumeUpdate(row.id, '/resumes');
    rememberReturnTo('/resumes');
    router.push('/resume');
  }

  function onCheckAts(row: ResumeRecord) {
    rememberReturnTo('/resumes');
    router.push(`/ats?resumeId=${encodeURIComponent(row.id)}`);
  }

  function onAddNew() {
    if (uploading) return;
    setError('');
    setToast('');
    setFailedResumeId(null);
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  }

  async function waitForProcessing(resumeId: string) {
    for (let i = 0; i < 40; i += 1) {
      const result = await getResumeProcessingStatus(resumeId);
      if (result.processingStatus === 'COMPLETED') return;
      if (result.processingStatus === 'FAILED') {
        setFailedResumeId(resumeId);
        throw new Error(result.processingError || 'Resume processing failed.');
      }
      setUploadStatus(i < 2 ? 'Uploading to cloud…' : 'Document AI + AI parser…');
      await new Promise((r) => setTimeout(r, 1500));
    }
    setFailedResumeId(resumeId);
    throw new Error('Processing is taking too long. Please retry.');
  }

  async function onFilePicked(file: File) {
    setUploading(true);
    setError('');
    setToast('');
    setFailedResumeId(null);
    setUploadStatus('Uploading to cloud…');
    try {
      const uploaded = await uploadResumeFile(file);
      setUploadStatus('Document AI + AI parser…');
      await waitForProcessing(uploaded.id);
      setUploadStatus('Almost there…');
      await refresh();
      setHighlightId(uploaded.id);
      setToast(`“${uploaded.title || file.name}” added to your resumes.`);
      setUploadStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add resume.');
      setUploadStatus('');
      await refresh().catch(() => undefined);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onRetryProcessing(resumeId: string) {
    setRetryingId(resumeId);
    setError('');
    setToast('');
    setUploadStatus('Retrying…');
    setUploading(true);
    try {
      await retryResumeProcessing(resumeId);
      setFailedResumeId(null);
      await waitForProcessing(resumeId);
      await refresh();
      setHighlightId(resumeId);
      setToast('Resume processed successfully.');
      setUploadStatus('');
    } catch (err) {
      setFailedResumeId(resumeId);
      setError(err instanceof Error ? err.message : 'Retry failed. Please try again.');
      setUploadStatus('');
      await refresh().catch(() => undefined);
    } finally {
      setRetryingId(null);
      setUploading(false);
    }
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
      if (viewingId === pendingDelete.id) closePreview();
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
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        disabled={uploading}
        onChange={(e) => {
          const next = e.target.files?.[0];
          if (next) void onFilePicked(next);
        }}
      />

      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Your resumes</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Uploaded files are stored in Cloud Storage and parsed with Google Document AI.
          </p>
        </div>

        {toast ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {toast}
          </p>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            {failedResumeId ? (
              <button
                type="button"
                disabled={uploading}
                onClick={() => void onRetryProcessing(failedResumeId)}
                className="mt-3 rounded-xl bg-[#0a2e2c] px-4 py-2 text-sm font-bold text-white hover:bg-[#072422] disabled:opacity-60"
              >
                {retryingId === failedResumeId ? 'Retrying…' : 'Retry processing'}
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading resumes…</p>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No resumes yet.</p>
            <p className="mt-1 text-sm text-slate-500">Upload a resume file to get started.</p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={uploading}
                onClick={onAddNew}
                className="min-w-[12rem] rounded-xl bg-[#0a2e2c] px-6 py-3 text-sm font-bold text-white hover:bg-[#072422] disabled:opacity-60"
              >
                Add Resume
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-3">
              {items.map((row) => {
                const isOpen = viewingId === row.id;
                const failed = row.processingStatus === 'FAILED';
                const processing =
                  row.processingStatus === 'PENDING' || row.processingStatus === 'PROCESSING';
                return (
                  <li
                    key={row.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                      highlightId === row.id
                        ? 'border-emerald-400 ring-2 ring-emerald-200'
                        : isOpen
                          ? 'border-[#0a2e2c]/40'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
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
                        {failed ? (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            {row.processingError || 'Processing failed.'}
                          </p>
                        ) : null}
                        {processing ? (
                          <p className="mt-2 text-xs font-semibold text-amber-700">Processing…</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void onViewResume(row)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-[#0a2e2c] transition hover:bg-[#0a2e2c]/8"
                      >
                        {isOpen ? 'Hide' : 'View resume'}
                      </button>
                    </div>

                    <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5">
                      {failed ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void onRetryProcessing(row.id)}
                          className="min-w-[7.5rem] rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 sm:min-w-[8.5rem] disabled:opacity-60"
                        >
                          {retryingId === row.id ? 'Retrying…' : 'Retry'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="min-w-[7.5rem] rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:min-w-[8.5rem]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onCheckAts(row)}
                        className="min-w-[7.5rem] rounded-xl bg-[#0a2e2c] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#072422] sm:min-w-[8.5rem]"
                      >
                        Check ATS
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        className="min-w-[7.5rem] rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 sm:min-w-[8.5rem]"
                      >
                        Delete
                      </button>
                    </div>

                    {isOpen ? (
                      viewLoading && !viewUrl ? (
                        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          Loading from Cloud Storage…
                        </p>
                      ) : viewError ? (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                          <p className="text-sm font-semibold text-red-700">{viewError}</p>
                          <button
                            type="button"
                            onClick={() => void loadCloudView(row.id)}
                            className="mt-3 rounded-xl bg-[#0a2e2c] px-4 py-2 text-sm font-bold text-white"
                          >
                            Retry
                          </button>
                        </div>
                      ) : viewUrl && viewMeta ? (
                        <CloudResumePreview
                          url={viewUrl}
                          mimeType={viewMeta.mimeType}
                          fileName={viewMeta.fileName}
                          onClose={closePreview}
                          onRetry={() => void loadCloudView(row.id)}
                        />
                      ) : null
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex justify-center pb-4">
              <button
                type="button"
                disabled={uploading}
                onClick={onAddNew}
                className="min-w-[12rem] rounded-xl bg-[#0a2e2c] px-6 py-3 text-sm font-bold text-white hover:bg-[#072422] disabled:opacity-60"
              >
                Add Resume
              </button>
            </div>
          </>
        )}
      </div>

      {uploading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#0a2e2c]" />
            <h2 className="mt-5 text-lg font-extrabold text-slate-900">
              {uploadStatus || 'Processing resume…'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Cloud Storage → Document AI → AI parser. Hang tight.
            </p>
          </div>
        </div>
      ) : null}

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
