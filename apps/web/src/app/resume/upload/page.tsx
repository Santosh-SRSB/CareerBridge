'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { getResumeProcessingStatus, uploadResumeFile } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

type UploadPhase = 'idle' | 'uploading' | 'extracting' | 'saving' | 'done' | 'failed';

const PHASE_COPY: Record<Exclude<UploadPhase, 'idle' | 'failed'>, string> = {
  uploading: 'Uploading your resume…',
  extracting: 'Extracting your data…',
  saving: 'Saving results…',
  done: 'Done. Taking you to the dashboard…',
};

export default function ResumeUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');

  useEffect(() => {
    if (!getStoredUser()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    let ticks = 0;
    let connectionFails = 0;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await getResumeProcessingStatus(resumeId);
        if (cancelled) return;
        connectionFails = 0;

        if (result.processingStatus === 'PENDING' || result.processingStatus === 'PROCESSING') {
          setPhase(ticks >= 2 ? 'saving' : 'extracting');
        }

        if (result.processingStatus === 'COMPLETED') {
          setPhase('done');
          setLoading(false);
          redirectTimer = window.setTimeout(() => {
            router.replace('/dashboard');
          }, 600);
          return;
        }

        if (result.processingStatus === 'FAILED') {
          setPhase('failed');
          setLoading(false);
          setError(result.processingError || 'Resume processing failed. Please try again.');
          return;
        }
      } catch (err) {
        connectionFails += 1;
        if (!cancelled && connectionFails >= 3) {
          setPhase('failed');
          setLoading(false);
          setError(
            err instanceof Error
              ? err.message
              : 'Cannot reach the CareerBridge API. Make sure it is running on port 3001.',
          );
          return;
        }
      }

      ticks += 1;
      if (!cancelled && ticks < 40) {
        window.setTimeout(poll, 1600);
      } else if (!cancelled) {
        setPhase('failed');
        setLoading(false);
        setError('Processing is taking longer than expected. You can open Resumes later from the dashboard.');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [resumeId, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Please choose a resume file to upload.');
      return;
    }
    setError('');
    setLoading(true);
    setPhase('uploading');
    try {
      const saved = await uploadResumeFile(file);
      setResumeId(saved.id);
      setPhase('extracting');
    } catch (err) {
      setLoading(false);
      setPhase('failed');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }

  const busy = loading || phase === 'done';

  return (
    <CandidateAppShell activeTab="resume" maxWidth="max-w-xl">
      <div className="mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0d9488]">Resume</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Upload Resume</h1>
          <p className="mt-2 text-sm text-slate-600">
            Upload the resume you downloaded (or another PDF/Word file). We save it, extract your
            details, and take you to the dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-800">Resume file</span>
            <input
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0a2e2c] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
            />
          </label>
          {file ? (
            <p className="text-xs text-slate-500">
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          ) : null}

          {phase !== 'idle' && phase !== 'failed' ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
              <p className="text-sm font-bold text-[#047857]">{PHASE_COPY[phase]}</p>
              <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li className={phase === 'uploading' ? 'font-bold text-[#0a2e2c]' : ''}>1. Upload to cloud</li>
                <li className={phase === 'extracting' ? 'font-bold text-[#0a2e2c]' : ''}>2. Extract data</li>
                <li className={phase === 'saving' || phase === 'done' ? 'font-bold text-[#0a2e2c]' : ''}>
                  3. Save results
                </li>
                <li className={phase === 'done' ? 'font-bold text-[#0a2e2c]' : ''}>4. Go to dashboard</li>
              </ol>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" loading={busy && phase !== 'done'} loadingLabel="Working..." className="flex-1" disabled={busy}>
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.replace('/dashboard')}
            >
              {phase === 'done' ? 'Go to dashboard' : 'Skip to dashboard'}
            </Button>
          </div>
        </form>
      </div>
    </CandidateAppShell>
  );
}
