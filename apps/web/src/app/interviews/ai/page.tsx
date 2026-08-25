'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createLiveInterview, getCandidateMe, listResumes } from '@/lib/api';
import { draftToResumeContent } from '@/lib/resume-build';
import type { PassportDraft } from '@/types/passport';
import { CandidateShell } from '@/components/CandidatePortal';
import { Button } from '@/components/ui/Button';
import { EagleMascot } from '@/features/candidate/passport/EagleMascot';

const TYPES = [
  { id: 'RESUME', label: 'Resume-based' },
  { id: 'HR', label: 'HR only' },
  { id: 'TECHNICAL', label: 'Technical only' },
  { id: 'BEHAVIOURAL', label: 'Behavioural' },
  { id: 'ROLE', label: 'Role-based' },
  { id: 'MIXED', label: 'Mixed' },
];

async function parseResumeFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/v1/candidates/resume/parse', { method: 'POST', body: form });
  const json = (await response.json()) as { success?: boolean; data?: PassportDraft; error?: { message?: string } };
  if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message || 'Could not read that resume.');
  return json.data;
}

export default function AiInterviewSetupPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pickStarted = useRef(0);
  const [step, setStep] = useState<'source' | 'brief'>('source');
  const [source, setSource] = useState<'PASSPORT' | 'UPLOAD'>('PASSPORT');
  const [type, setType] = useState('RESUME');
  const [duration, setDuration] = useState(15);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [picking, setPicking] = useState(false);
  const [uploadContent, setUploadContent] = useState<ReturnType<typeof draftToResumeContent> | null>(null);

  useEffect(() => {
    if (!picking) return;
    const onFocus = () => {
      if (Date.now() - pickStarted.current < 450) return;
      setPicking(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [picking]);

  const openPicker = () => {
    if (busy || picking) return;
    setPicking(true);
    pickStarted.current = Date.now();
    window.setTimeout(() => inputRef.current?.click(), 400);
  };

  async function onDrop(file: File) {
    setError('');
    setBusy(true);
    try {
      const [draft, profile] = await Promise.all([parseResumeFile(file), getCandidateMe()]);
      setUploadContent(draftToResumeContent(draft, { phone: profile.phone, city: profile.city }));
      setSource('UPLOAD');
      setStep('brief');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that resume.');
    } finally {
      setBusy(false);
      setPicking(false);
    }
  }

  async function start() {
    if (!consent) {
      setError('Please accept the interview consent to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (source === 'PASSPORT') {
        const resumes = await listResumes().catch(() => []);
        if (!resumes.length) {
          const me = await getCandidateMe();
          if (!me.firstName) throw new Error('Create your Career Passport first, or drop a resume.');
        }
      }
      const session = await createLiveInterview({
        interviewType: type,
        durationLimitMin: duration,
        source,
        content: source === 'UPLOAD' && uploadContent ? uploadContent : undefined,
      });
      router.push(`/interviews/live/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the interview.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">AI Live Interview</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
        {step === 'source' ? 'How should the AI interview you?' : 'Before you start'}
      </h1>

      {step === 'source' ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <button
            type="button"
            className="cb-interview-choice is-ai"
            onClick={() => {
              setSource('PASSPORT');
              setStep('brief');
            }}
          >
            <span className="cb-interview-choice-photo is-passport">
              <Image
                src="/mascots/passport-without-resume.png"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            </span>
            <strong>Go with your Career Passport</strong>
            <p>Questions come from your saved education, skills, experience and projects. No extra upload.</p>
          </button>
          <div className="cb-interview-choice is-human cb-interview-upload-card">
            <strong>Drop your latest resume</strong>
            <p>We read the file and interview from that version instead of the Passport.</p>
            <div className="resume-point mt-2">
              <EagleMascot pose="point" />
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPicking(false);
                  event.target.value = '';
                  if (file) void onDrop(file);
                }}
              />
              <button
                type="button"
                className={`resume-drop-tip${drag ? ' is-drag' : ''}${picking ? ' is-picking' : ''}`}
                disabled={busy}
                onClick={openPicker}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDrag(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void onDrop(file);
                }}
              >
                {picking || busy ? (
                  <>
                    <span className="resume-drop-tip-title">{busy ? 'Reading' : 'Loading'}</span>
                    <span className="drop-loading-dots drop-loading-dots-on-dark" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="resume-drop-tip-title">Upload resume</span>
                    <span className="resume-drop-tip-sub">PDF, Word or text</span>
                  </>
                )}
              </button>
              {error ? <p className="resume-point-error">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="cb-dash-card mt-6 max-w-2xl space-y-4 p-5">
          <ul className="space-y-2 text-sm text-primary">
            <li>Make sure your microphone and camera work.</li>
            <li>Sit in a quiet, well-lit place with your face visible.</li>
            <li>Do not switch tabs or use another person for help.</li>
            <li>Answer in your own words. You can Quit anytime — we still analyse what you said.</li>
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Type
              <select className="mt-1 w-full rounded-md border border-primary/15 px-2 py-2" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted">
                First question is always introduce yourself. HR stays HR. Technical stays on your stacks. Mixed is intro, project, tech, then HR.
              </span>
            </label>
            <label className="text-sm font-bold">
              Duration
              <select className="mt-1 w-full rounded-md border border-primary/15 px-2 py-2" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I understand microphone and camera may be used, answers are processed by AI, integrity signals (tab switch, mic) may be recorded, and authorised recruiters may view the report.
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep('source')}>Back</Button>
            <Button type="button" disabled={busy} onClick={() => void start()}>
              {busy ? 'Opening AI room...' : 'Continue to AI room'}
            </Button>
          </div>
        </div>
      )}
    </CandidateShell>
  );
}
