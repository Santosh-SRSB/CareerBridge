'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ResumeRecord } from '@careerbridge/shared';
import { getCandidateMe, getResume, updateResume } from '@/lib/api';
import { downloadResumePdfFile } from '@/lib/resume-pdf';
import { CandidateShell } from '@/components/CandidatePortal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ScoreRing';
import { ResumePaper } from '@/components/ResumePaper';

export default function ResumeEditorPage() {
  const params = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [summary, setSummary] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    getResume(params.id).then((item) => {
      setResume(item);
      setSummary(item.summary || item.content.summary);
    });
    getCandidateMe()
      .then((profile) => setPhotoUrl(profile.photoUrl || null))
      .catch(() => setPhotoUrl(null));
  }, [params.id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updated = await updateResume(params.id, { summary });
      setResume(updated);
      setMessage('Your resume was saved successfully.');
    } finally {
      setSaving(false);
    }
  }

  async function onDownload() {
    if (!resume) return;
    setDownloading(true);
    try {
      await downloadResumePdfFile({
        content: { ...resume.content, summary: summary || resume.content.summary },
        template: resume.template,
        photoUrl: resume.content.includePhoto === false ? null : photoUrl,
        fileName: `${resume.title.replace(/\s+/g, '-')}.pdf`,
      });
    } finally {
      setDownloading(false);
    }
  }

  if (!resume) {
    return (
      <CandidateShell>
        <p className="text-muted">Loading your resume...</p>
      </CandidateShell>
    );
  }

  const analysis = resume.analysis;
  const showEditor = tab === 'edit';

  return (
    <CandidateShell>
      <Link href="/resume" className="text-sm font-bold text-teal hover:underline">
        ← My resumes
      </Link>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Resume builder</p>
          <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{resume.title}</h1>
          <p className="mt-1 text-muted">
            {resume.targetJobTitle ? `Target: ${resume.targetJobTitle}` : 'General professional resume'}
            {` · Version ${resume.version}`}
          </p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-[0_16px_40px_rgba(10,46,44,0.1)] sm:w-auto">
          <ScoreRing value={resume.score} size={64} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary">ATS readiness</p>
            <p className="mt-1 text-sm text-muted">You&apos;re {resume.score}% ready for your next opportunity.</p>
          </div>
        </div>
      </section>

      <div className="relative grid max-w-xs grid-cols-2 rounded-md bg-primary/5 p-0.5 ring-1 ring-primary/10">
        <span
          className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm bg-primary shadow-sm transition-transform duration-300 ease-out ${
            tab === 'preview' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`relative z-10 rounded-sm px-3 py-2.5 text-sm font-bold ${tab === 'edit' ? 'text-white' : 'text-primary/60'}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`relative z-10 rounded-sm px-3 py-2.5 text-sm font-bold ${tab === 'preview' ? 'text-white' : 'text-primary/60'}`}
        >
          Preview
        </button>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className={showEditor ? 'block min-w-0' : 'hidden min-w-0 xl:block'}>
          <form onSubmit={onSave} className="cb-dash-card space-y-5 p-4 sm:p-5">
            <Textarea
              label="Professional summary"
              name="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              hint="Write 3–5 lines about the work you want and what you can do."
              className="min-h-40 rounded-md bg-[#faf8f3] leading-7"
            />
            <div>
              <p className="text-sm font-bold text-primary">Skills</p>
              {resume.content.skills.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {resume.content.skills.map((skill) => (
                    <span key={skill} className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Add skills in your Career Passport.</p>
              )}
            </div>
            {analysis ? (
              <div className="rounded-md bg-[#f6fbf7] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">AI analysis</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {analysis.complete.map((item) => (
                    <p key={item} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-success">
                      ✓ {item}
                    </p>
                  ))}
                  {analysis.improve.map((item) => (
                    <p key={item} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-warning">
                      ⚠ {item}
                    </p>
                  ))}
                </div>
                {analysis.suggestions.length ? (
                  <ul className="mt-3 space-y-2">
                    {analysis.suggestions.map((item) => (
                      <li key={item.id} className="text-sm leading-6 text-muted">
                        {item.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {message ? <p className="text-sm font-semibold text-success">{message}</p> : null}
            <Button type="submit" loading={saving} loadingLabel="Saving...">
              Save Resume
            </Button>
          </form>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={onDownload} loading={downloading} loadingLabel="Loading...">
              Download
            </Button>
            <Link
              href="/passport?overview=1"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-primary bg-surface px-4 py-3 text-center font-bold text-primary"
            >
              Edit Passport
            </Link>
          </div>
        </div>

        <div className={showEditor ? 'hidden min-w-0 xl:block' : 'block min-w-0'}>
          <div className="cb-resume-desk">
            <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              Live paper preview
            </p>
            <ResumePaper content={resume.content} summary={summary} targetJobTitle={resume.targetJobTitle} />
          </div>
        </div>
      </div>
    </CandidateShell>
  );
}
