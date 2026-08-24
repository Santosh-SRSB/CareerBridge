'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PassportDraft } from '@/types/passport';
import { getCandidateMe, uploadResume } from '@/lib/api';
import { draftToResumeContent } from '@/lib/resume-build';
import { CandidateShell } from '@/components/CandidatePortal';
import { EagleMascot } from '@/features/candidate/passport/EagleMascot';

async function parseResumeFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/v1/candidates/resume/parse', {
    method: 'POST',
    body: form,
  });
  const json = (await response.json()) as {
    success?: boolean;
    data?: PassportDraft;
    rawText?: string;
    error?: { message?: string };
  };
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message || 'Could not read that resume.');
  }
  return { draft: json.data, rawText: json.rawText || '' };
}

export default function ResumeEnhanceDropPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function onFile(file: File) {
    setError('');
    setBusy(true);
    setStatus('Uploading resume...');
    try {
      const [{ draft, rawText }, profile] = await Promise.all([parseResumeFile(file), getCandidateMe()]);
      setStatus('Reading resume...');
      await new Promise((resolve) => setTimeout(resolve, 250));
      setStatus('Extracting content...');
      const content = draftToResumeContent(draft, { phone: profile.phone, city: profile.city });
      setStatus('Analyzing resume...');
      const resume = await uploadResume({
        fileName: file.name,
        targetJobTitle: draft.careerInterests[0] || profile.careerInterests[0] || undefined,
        content,
        rawText,
      });
      setStatus('Checking ATS compatibility...');
      router.push(`/resume/enhance/${resume.id}`);
    } catch (err) {
      setStatus('');
      setError(err instanceof Error ? err.message : 'Could not save that resume.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Resume enhancement</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Drop your resume</h1>
      <p className="mt-2 max-w-xl text-muted">
        We will read your file, score ATS readiness, and show exactly what to fix. This first report is free.
      </p>

      <div className="resume-point mt-10">
        <EagleMascot pose="point" />
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.txt"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onFile(file);
          }}
        />
        <button
          type="button"
          className={`resume-drop-tip${drag ? ' is-drag' : ''}${busy ? ' is-picking' : ''}`}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            const file = event.dataTransfer.files[0];
            if (file) void onFile(file);
          }}
        >
          {busy ? (
            <>
              <span className="resume-drop-tip-title">{status || 'Loading...'}</span>
              <span className="drop-loading-dots drop-loading-dots-on-dark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </>
          ) : (
            <>
              <span className="resume-drop-tip-title">Drop resume</span>
              <span className="resume-drop-tip-sub">PDF, Word or text</span>
            </>
          )}
        </button>
        {error ? <p className="resume-point-error">{error}</p> : null}
      </div>
    </CandidateShell>
  );
}
