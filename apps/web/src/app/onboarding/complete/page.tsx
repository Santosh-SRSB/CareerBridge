'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  OnboardingFrame,
  OnboardingIcon,
  OnboardingLoading,
  obxGhostButtonClass,
  obxPrimaryButtonClass,
} from '@/components/OnboardingFrame';
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

  if (!ready) return <OnboardingLoading step={4} showProgress={false} />;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        aria-label="Upload your resume file"
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

      <OnboardingFrame step={4} showProgress={false}>
        <div className="obx-center obx-choice">
          <div className="obx-big">
            <OnboardingIcon name="sparkle" size={34} />
          </div>
          <h1>Your profile looks incomplete</h1>
          <p className="obx-lead">Complete it to get noticed.</p>

          <div className="obx-stats">
            <div className="obx-stat">
              <strong>
                {statViews}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 17 10 10 14 14 21 5" />
                  <polyline points="21 11 21 5 15 5" />
                </svg>
              </strong>
              <span>more recruiter views on complete profiles</span>
            </div>
            <div className="obx-stat">
              <strong>{statResponse}</strong>
              <span>faster response from employers</span>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={openFilePicker}
            className={`${obxPrimaryButtonClass} obx-wide`}
          >
            Upload resume
          </button>
          <p className="obx-muted">PDF, DOC, DOCX, PNG or JPG</p>

          <p className="obx-or">Don&apos;t have a resume?</p>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              markResumeBuildPath();
              rememberReturnTo('/onboarding/complete');
              router.push('/resume?from=build');
            }}
            className={`${obxGhostButtonClass} obx-wide`}
          >
            Build ATS resume
            <OnboardingIcon name="arrow" size={18} />
          </button>

          {error && !file ? (
            <p role="alert" className="obx-error" style={{ justifyContent: 'center' }}>
              {error}
            </p>
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
        <div className="obx-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-upload-title">
          <div className="obx-modal-card">
            <h2 id="confirm-upload-title">Confirm upload</h2>
            <p className="obx-muted">We&apos;ll extract details and open the resume wizard.</p>
            <p className="obx-file">
              {file.name} <span>({Math.round(file.size / 1024)} KB)</span>
            </p>

            {status ? <p className="obx-cnt">{status}</p> : null}
            {error ? (
              <div role="alert">
                <p className="obx-error">{error}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRetryProcessing()}
                  className={`${obxGhostButtonClass} obx-wide`}
                  style={{ marginTop: 12 }}
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="obx-modal-actions">
              <button type="button" disabled={busy} onClick={clearSelectedFile} className={obxGhostButtonClass}>
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void onAddResume()} className={obxPrimaryButtonClass}>
                {busy ? 'Working…' : 'Add'}
              </button>
            </div>
            {!busy ? (
              <button type="button" onClick={openFilePicker} className="obx-link obx-wide">
                Choose a different file
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
