'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe, getResume, getResumeProcessingStatus, uploadResumeFile } from '@/lib/api';
import {
  markResumeAutofillSeed,
  markResumeBuildPath,
} from '@/features/resume/resume-wizard-draft';
import { mapResumeRecordToWizardSeed } from '@/features/resume/resume-record-to-wizard';

const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        patchStoredUser({
          firstName: profile.firstName,
          onboardingCompleted: true,
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('sign in') || (err as { code?: string })?.code === 'UNAUTHORIZED') {
          router.replace('/login');
          return;
        }
      })
      .finally(() => setReady(true));
  }, [router]);

  function openFilePicker() {
    if (busy) return;
    setError('');
    setStatus('');
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  }

  function clearSelectedFile() {
    if (busy) return;
    setFile(null);
    setError('');
    setStatus('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function waitForProcessing(resumeId: string) {
    for (let i = 0; i < 40; i += 1) {
      const result = await getResumeProcessingStatus(resumeId);
      if (result.processingStatus === 'COMPLETED') return;
      if (result.processingStatus === 'FAILED') {
        throw new Error(result.processingError || 'Resume processing failed.');
      }
      setStatus(i < 2 ? 'Extracting details…' : 'Almost done…');
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Processing is taking too long. Please try again.');
  }

  async function onAddResume() {
    if (!file) {
      setError('Please select a resume file.');
      return;
    }
    setError('');
    setBusy(true);
    setStatus('Uploading resume…');
    try {
      const uploaded = await uploadResumeFile(file);
      setStatus('Extracting details…');
      await waitForProcessing(uploaded.id);
      const record = await getResume(uploaded.id);
      const seed = mapResumeRecordToWizardSeed(record);
      markResumeAutofillSeed({ seed, resumeId: record.id });
      router.push('/resume?from=autofill');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      if (message.includes('sign in') || (err as { code?: string })?.code === 'UNAUTHORIZED') {
        router.replace('/login');
        return;
      }
      setError(message);
      setBusy(false);
      setStatus('');
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] px-5 py-10">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.files?.[0] || null;
          setFile(next);
          setError('');
          setStatus('');
        }}
      />

      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2e2c]/10 text-[#0a2e2c]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 12.5l2 2 4.5-4.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#0d9488]">
          You&apos;re ready
        </p>

        <div className="mt-5 rounded-xl border border-orange-300/80 bg-gradient-to-r from-orange-500 via-orange-400 to-red-500 px-4 py-3 shadow-sm shadow-orange-500/25">
          <p className="text-center text-base font-extrabold text-white drop-shadow-sm sm:text-[1.05rem]">
            Your profile looks incomplete 🙄
          </p>
        </div>
        <p className="mt-2 text-center text-sm font-medium text-slate-600">
          Complete it to get noticed.
        </p>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[6%] rounded-full bg-[#e68a39]" />
        </div>
        <p className="mt-1.5 text-center text-xs font-semibold text-slate-500">6% complete</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border-2 border-[#0a2e2c] bg-[#0a2e2c] p-5 text-left text-white shadow-sm">
            <button
              type="button"
              disabled={busy}
              onClick={openFilePicker}
              className="group flex w-full cursor-pointer flex-col items-start text-left disabled:opacity-70"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 17.5V19a2 2 0 002 2h10a2 2 0 002-2v-1.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <p className="mt-4 text-base font-extrabold">Autofill with resume</p>
              <p className="mt-1.5 text-sm leading-snug text-white/75">
                Upload your resume and we&apos;ll fill in the rest for you.
              </p>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={openFilePicker}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#e68a39] px-4 py-2.5 text-sm font-bold text-[#0a2e2c] transition hover:bg-[#f0a04e] disabled:opacity-60"
            >
              Upload resume
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              markResumeBuildPath();
              router.push('/resume?from=build');
            }}
            className="group flex cursor-pointer flex-col items-start rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-[#0a2e2c]/40 hover:bg-white hover:shadow-md disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0a2e2c] shadow-sm ring-1 ring-slate-200 transition group-hover:ring-[#0a2e2c]/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M14 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path
                  d="M8.5 13h7M8.5 16.5h5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mt-4 text-base font-extrabold text-slate-900">Build Resume</p>
            <p className="mt-1.5 text-sm leading-snug text-slate-600">
              Build from scratch, then check ATS score, improve with AI, and save.
            </p>
            <span className="mt-4 text-sm font-bold text-[#0a2e2c]">Start building →</span>
          </button>
        </div>

        {error && !file ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
      </div>

      {file ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-upload-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="confirm-upload-title" className="text-lg font-extrabold text-slate-900">
              Confirm upload
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Click Add to extract details and open the wizard.
            </p>
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
              {file.name}{' '}
              <span className="font-medium text-slate-500">({Math.round(file.size / 1024)} KB)</span>
            </p>

            {status ? <p className="mt-3 text-sm font-semibold text-[#0a2e2c]">{status}</p> : null}
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={clearSelectedFile}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onAddResume()}
                className="flex-1 rounded-xl bg-[#0a2e2c] py-2.5 text-sm font-bold text-white hover:bg-[#072422] disabled:opacity-60"
              >
                {busy ? 'Working…' : 'Add'}
              </button>
            </div>
            {!busy ? (
              <button
                type="button"
                onClick={openFilePicker}
                className="mt-3 w-full text-center text-sm font-semibold text-[#0a2e2c] hover:underline"
              >
                Choose a different file
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
