'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OB, OnboardingFrame, onboardingPrimaryButtonClass } from '@/components/OnboardingFrame';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe, getResumeProcessingStatus, retryResumeProcessing, uploadResumeFile } from '@/lib/api';
import {
  markResumePendingParse,
  markResumeBuildPath,
} from '@/features/resume/resume-wizard-draft';
import { rememberReturnTo } from '@/lib/nav-return';
import { SuccessCelebration } from '@/components/SuccessCelebration';

const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

function guessNameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[_-]?resume.*$/i, '')
    .replace(/[_-]?cv.*$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2) return '';
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(
  enabled: boolean,
  target: number,
  suffix: string,
  decimals: number,
  duration: number,
  delay: number,
) {
  const [text, setText] = useState(`0${suffix}`);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(target.toFixed(decimals) + suffix);
      return;
    }

    let frame = 0;
    const startAt = performance.now() + delay;

    const tick = (now: number) => {
      if (now < startAt) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min((now - startAt) / duration, 1);
      setText((target * easeOutCubic(t)).toFixed(decimals) + suffix);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, target, suffix, decimals, duration, delay]);

  return text;
}

export default function OnboardingCompletePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [failedResumeId, setFailedResumeId] = useState<string | null>(null);
  const [uploadCelebration, setUploadCelebration] = useState<'idle' | 'loading' | 'success'>('idle');

  const statViews = useCountUp(ready, 3.2, 'x', 1, 900, 550);
  const statResponse = useCountUp(ready, 65, '%', 0, 900, 650);

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

  async function openWizardAfterUpload(resumeId: string, fileName: string) {
    const stored = getStoredUser();
    const guessed = guessNameFromFile(fileName);
    markResumePendingParse({
      resumeId,
      fullName: guessed || stored?.firstName || '',
    });
    setStatus('reading');
    setUploadCelebration('loading');

    // Keep the “reading” overlay up until Document AI / Gemini finishes (or times out).
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const result = await getResumeProcessingStatus(resumeId);
        if (result.processingStatus === 'COMPLETED') break;
        if (result.processingStatus === 'FAILED') {
          setFailedResumeId(resumeId);
          throw new Error(result.processingError || 'We could not read this resume. Please retry.');
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('could not read')) throw err;
        // Soft-continue on transient network errors while still showing the reading UI.
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    setUploadCelebration('success');
    await new Promise((r) => setTimeout(r, 450));
    rememberReturnTo('/onboarding/complete');
    router.push('/resume?from=autofill');
  }

  async function onAddResume() {
    if (!file) {
      setError('Please select a resume file.');
      return;
    }
    setError('');
    setFailedResumeId(null);
    setBusy(true);
    setUploadCelebration('loading');
    setStatus('uploading');
    try {
      const uploaded = await uploadResumeFile(file);
      await openWizardAfterUpload(uploaded.id, file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      if (message.includes('sign in') || (err as { code?: string })?.code === 'UNAUTHORIZED') {
        router.replace('/login');
        return;
      }
      setError(message);
      setBusy(false);
      setStatus('');
      setUploadCelebration('idle');
    }
  }

  async function onRetryProcessing() {
    if (!failedResumeId) {
      void onAddResume();
      return;
    }
    setError('');
    setBusy(true);
    setUploadCelebration('loading');
    setStatus('uploading');
    try {
      await retryResumeProcessing(failedResumeId);
      await openWizardAfterUpload(failedResumeId, file?.name || 'resume.pdf');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed. Please try again.';
      setError(message);
      setBusy(false);
      setStatus('');
      setUploadCelebration('idle');
    }
  }

  if (!ready) {
    return (
      <main
        className="flex h-dvh items-center justify-center text-sm"
        style={{ background: OB.bg, color: OB.muted }}
      >
        Loading…
      </main>
    );
  }

  return (
    <>
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

      <OnboardingFrame
        step={4}
        showProgress={false}
        showBack
        hideHeader
        backHref="/onboarding/dossier"
      >
        <div className="cb-ob-complete cb-ob-hide-scrollbar flex min-h-0 flex-1 flex-col justify-center py-2">
          <h2
            className="cb-ob-complete-fx cb-ob-complete-title m-0 text-[1.5rem] leading-[1.28] tracking-[-0.2px] sm:text-[1.7rem]"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
              fontWeight: 600,
              color: OB.ink,
            }}
          >
            Your profile looks incomplete
          </h2>

          <p className="cb-ob-complete-fx cb-ob-complete-sub !mb-0 mt-2 text-[15px] sm:text-base">
            <span className="cb-ob-complete-hl">Complete it to get noticed.</span>
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
            <div
              className="cb-ob-complete-stat rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
              style={{ background: '#f6f5ee' }}
            >
              <p
                className="m-0 mb-1 tabular-nums text-[1.45rem] font-semibold sm:text-[1.6rem]"
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
                  color: OB.moss,
                }}
              >
                {statViews}
                <span className="cb-ob-complete-trend" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <polyline
                      points="3 17 10 10 14 14 21 5"
                      stroke={OB.moss}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="21 11 21 5 15 5"
                      stroke={OB.moss}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </p>
              <p className="m-0 text-[12px] leading-snug sm:text-[13px]" style={{ color: '#7d7d73' }}>
                more recruiter views on complete profiles
              </p>
            </div>
            <div
              className="cb-ob-complete-stat rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
              style={{ background: '#f6f5ee' }}
            >
              <p
                className="m-0 mb-1 tabular-nums text-[1.45rem] font-semibold sm:text-[1.6rem]"
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
                  color: OB.moss,
                }}
              >
                {statResponse}
              </p>
              <p className="m-0 text-[12px] leading-snug sm:text-[13px]" style={{ color: '#7d7d73' }}>
                faster response from employers
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={openFilePicker}
            className={`cb-ob-complete-primary ${onboardingPrimaryButtonClass} mt-8 w-full py-3.5 text-[15px] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(10,46,44,0.28)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60 sm:mt-10 sm:py-4 sm:text-base`}
            style={{ background: OB.moss }}
          >
            Upload resume
          </button>

          <p
            className="cb-ob-complete-link mt-10 mb-3 text-center text-[15px] font-semibold sm:text-base"
            style={{ color: OB.ink }}
          >
            Don&apos;t have a resume?
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              markResumeBuildPath();
              rememberReturnTo('/onboarding/complete');
              router.push('/resume?from=build');
            }}
            className="cb-ob-complete-secondary flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] bg-white py-3.5 text-[15px] font-semibold transition hover:-translate-y-px hover:bg-[#f6f5ee] active:translate-y-0 active:scale-[0.98] disabled:opacity-60 sm:py-4 sm:text-base"
            style={{ borderColor: OB.moss, color: OB.ink }}
          >
            <span>Build ATS resume</span>
            <span className="cb-ob-complete-arrow" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <line
                  x1="5"
                  y1="12"
                  x2="19"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <polyline
                  points="12 5 19 12 12 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          {error && !file ? (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </OnboardingFrame>

      {uploadCelebration !== 'idle' ? (
        <SuccessCelebration
          phase={uploadCelebration}
          loader="dots"
          loadingTitle={
            status === 'uploading'
              ? 'Your resume is uploading'
              : status === 'reading'
                ? 'We are reading your resume'
                : 'Uploaded successfully'
          }
          loadingSubtitle={
            status === 'uploading'
              ? 'Please wait a moment…'
              : status === 'reading'
                ? 'Extracting your education, skills and experience…'
                : 'Opening your resume wizard…'
          }
          successTitle="Resume ready"
          successSubtitle="Opening your combined profile wizard…"
        />
      ) : null}

      {file && uploadCelebration === 'idle' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(36,28,21,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-upload-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl sm:p-6"
            style={{ boxShadow: '0 12px 32px rgba(63,91,58,0.12)' }}
          >
            <h2
              id="confirm-upload-title"
              className="text-lg font-semibold"
              style={{
                fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
                color: OB.ink,
              }}
            >
              Confirm upload
            </h2>
            <p className="mt-1 text-sm" style={{ color: OB.muted }}>
              We&apos;ll extract details and open the resume wizard.
            </p>
            <p
              className="mt-4 rounded-lg border px-3 py-2 text-sm font-medium"
              style={{ borderColor: OB.lineSoft, background: OB.bg, color: OB.ink }}
            >
              {file.name}{' '}
              <span style={{ color: OB.muted }}>({Math.round(file.size / 1024)} KB)</span>
            </p>

            {status ? (
              <p className="mt-3 text-sm font-medium" style={{ color: OB.moss }}>
                {status}
              </p>
            ) : null}
            {error ? (
              <div className="mt-2">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRetryProcessing()}
                  className="mt-3 w-full rounded-full border py-2.5 text-sm font-semibold transition hover:bg-[#f6f5ee] disabled:opacity-60"
                  style={{ borderColor: OB.moss, color: OB.ink }}
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={clearSelectedFile}
                className="flex-1 rounded-full border bg-white py-2.5 text-sm font-medium transition hover:border-[#0A2E2C] disabled:opacity-60"
                style={{ borderColor: '#7A8270', color: OB.muted }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onAddResume()}
                className={onboardingPrimaryButtonClass + ' flex-1'}
                style={{ background: OB.moss }}
              >
                {busy ? 'Working…' : 'Add'}
              </button>
            </div>
            {!busy ? (
              <button
                type="button"
                onClick={openFilePicker}
                className="mt-3 w-full text-center text-sm font-medium hover:opacity-80"
                style={{ color: OB.moss }}
              >
                Choose a different file
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
