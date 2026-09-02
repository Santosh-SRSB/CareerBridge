'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RESUME_TEMPLATES, type ResumeRecord } from '@careerbridge/shared';
import { createResume, listResumes } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ScoreRing';

function ResumeHomeInner() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [target, setTarget] = useState('');
  const searchParams = useSearchParams();
  const presetTemplate = searchParams.get('template');
  const [template, setTemplate] = useState(presetTemplate || 'CLASSIC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (presetTemplate) setTemplate(presetTemplate);
  }, [presetTemplate]);

  useEffect(() => {
    listResumes().then(setResumes).catch(() => router.replace('/login'));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resume = await createResume({ targetJobTitle: target || undefined, template });
      router.push(`/resume/${resume.id}`);
    } catch {
      setError('We could not create your resume right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">AI Resume Builder</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Create your resume</h1>
      <p className="mt-2 max-w-2xl text-muted">
        We start from your Career Passport, not a blank template. Create a targeted resume or a general professional one.
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={onSubmit} className="cb-dash-card min-w-0 space-y-4 p-4 sm:p-5">
          <Input
            label="What job are you applying for?"
            name="target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Customer Service Executive"
            hint="Leave blank to create a general resume."
          />
          <label className="block" htmlFor="template">
            <span className="mb-1.5 block text-sm font-semibold text-primary">Template</span>
            <select
              id="template"
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              className="w-full rounded-md border border-primary/15 bg-[#faf8f3] px-3.5 py-3.5"
            >
              {RESUME_TEMPLATES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" loading={loading} loadingLabel="Creating...">
            {target ? 'Create targeted resume' : 'Create general resume'}
          </Button>
        </form>

        <section className="min-w-0">
          <h2 className="text-lg font-bold text-primary">My resumes</h2>
          {!resumes.length ? (
            <p className="mt-3 text-muted">You haven&apos;t created a resume yet. Create your first resume using your Career Passport.</p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {resumes.map((item) => (
              <Link key={item.id} href={`/resume/${item.id}`} className="cb-lift-card block min-w-0 p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal">Resume</p>
                    <p className="mt-1 break-words font-bold text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.targetJobTitle || 'General resume'}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Updated {new Date(item.updatedAt).toLocaleDateString()} · Version {item.version}
                    </p>
                  </div>
                  <ScoreRing value={item.score} size={64} />
                </div>
                <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-teal px-3 py-2 text-sm font-bold text-primary">
                  Open
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </CandidateShell>
  );
}

export default function ResumeHomePage() {
  return (
    <Suspense fallback={<main className="cb-portal-page p-8 text-sm text-muted">Loading resume builder...</main>}>
      <ResumeHomeInner />
    </Suspense>
  );
}
