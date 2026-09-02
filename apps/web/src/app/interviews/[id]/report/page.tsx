'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { downloadInterviewReport, getInterview } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ScoreRing';

export default function InterviewReportPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    getInterview(params.id).then(setSession);
  }, [params.id]);

  if (!session) {
    return (
      <CandidateShell>
        <p className="text-muted">Your interview has been completed. We are generating your detailed AI report...</p>
      </CandidateShell>
    );
  }

  const report = session.report;
  const duration = session.durationSec || 0;
  const answered = (session.liveQuestions || []).filter((item) => (item.answer || '').trim().length > 0);
  const answeredCount = report?.answeredCount ?? answered.length;
  const totalPlanned = report?.totalPlanned ?? 15;

  async function onDownload() {
    const file = await downloadInterviewReport(session!.id);
    const bytes = Uint8Array.from(atob(file.pdf), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CandidateShell>
      <Link href="/interviews" className="text-sm font-bold text-teal hover:underline">
        ← Interviews
      </Link>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">AI Interview Report</p>
      <h1 className="mt-1 text-2xl font-extrabold text-primary">{session.jobRole}</h1>
      <p className="mt-2 text-sm text-muted">
        {session.interviewType} · Start {session.startAt ? new Date(session.startAt).toLocaleString() : '—'} · End{' '}
        {session.endAt ? new Date(session.endAt).toLocaleString() : '—'} · Duration {Math.floor(duration / 60)} min {duration % 60} sec
      </p>
      <p className="mt-3 rounded-xl bg-teal/10 px-4 py-3 text-sm font-bold text-primary">
        {answeredCount} answer{answeredCount === 1 ? '' : 's'} given out of {totalPlanned}. Overall score is based only on those{' '}
        {answeredCount} response{answeredCount === 1 ? '' : 's'}.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="cb-dash-card flex items-center gap-3 p-4">
          <ScoreRing value={report?.overallScore ?? session.score ?? 0} size={72} label="Overall" />
          <div>
            <p className="text-sm text-muted">Overall</p>
            <p className="text-xl font-extrabold">{report?.overallScore ?? session.score ?? 0}/100</p>
          </div>
        </div>
        {[
          ['Communication', session.communicationScore ?? report?.communication],
          ['Behaviour', session.behaviourScore ?? report?.behaviour],
          ['Listening', session.listeningScore ?? report?.listening],
        ].map(([label, value]) => (
          <div key={String(label)} className="cb-dash-card p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-3xl font-extrabold text-primary">
              {value ?? 0}
              <span className="text-base">/10</span>
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 font-bold text-primary">Recommendation: {report?.recommendation || 'Needs Improvement'}</p>
      <p className="mt-2 max-w-3xl text-sm text-muted">{report?.summary}</p>
      <p className="mt-2 text-xs text-muted">This score is practice feedback. Recruiters make hiring decisions.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="cb-dash-card p-4">
          <h2 className="font-bold">Strengths</h2>
          <ul className="mt-2 space-y-1 text-sm">{(report?.strengths || []).map((item) => <li key={item}>✓ {item}</li>)}</ul>
        </section>
        <section className="cb-dash-card p-4">
          <h2 className="font-bold">Areas to improve</h2>
          <ul className="mt-2 space-y-1 text-sm">{(report?.weaknesses || []).map((item) => <li key={item}>→ {item}</li>)}</ul>
        </section>
      </div>

      <section className="cb-dash-card mt-4 p-4 text-sm">
        <h2 className="font-bold">Interview integrity (signals, not proof)</h2>
        <p className="mt-2">
          Tab switches: {report?.integrity.tabSwitches ?? 0} · Face not detected: {report?.integrity.faceMissing ?? 0} · Multiple faces:{' '}
          {report?.integrity.multipleFaces ?? 0} · Microphone issues: {report?.integrity.micIssues ?? 0} · Abuse warnings:{' '}
          {report?.integrity.abuseWarnings ?? 0} · Nonsense warnings: {report?.integrity.nonsenseWarnings ?? 0}
        </p>
      </section>

      <div className="mt-6 space-y-4">
        {answered.map((item) => (
          <details key={item.id} className="cb-dash-card p-4" open={item.number === 1}>
            <summary className="cursor-pointer font-extrabold text-primary">
              Question {item.number} · {item.score ?? 0}/100
            </summary>
            <p className="mt-3 text-xs font-bold uppercase text-teal">Question</p>
            <p className="mt-1 text-sm">{item.text}</p>
            <p className="mt-4 text-xs font-bold uppercase text-teal">Your answer</p>
            <p className="mt-1 text-sm">{item.answer}</p>
            {item.analysis ? (
              <>
                <p className="mt-4 text-xs font-bold uppercase text-teal">What can be improved</p>
                <p className="mt-1 text-sm text-muted">{item.analysis}</p>
              </>
            ) : null}
            <p className="mt-4 text-xs font-bold uppercase text-teal">Improved answer (based on your response)</p>
            <p className="mt-1 text-sm">{item.improvedAnswer || '—'}</p>
            {item.strengths?.length ? <p className="mt-2 text-sm">Strengths: {item.strengths.join(' · ')}</p> : null}
            {item.weaknesses?.length ? <p className="mt-1 text-sm text-muted">Add or fix: {item.weaknesses.join(' · ')}</p> : null}
          </details>
        ))}
      </div>

      <Button className="mt-6 max-w-xs" type="button" onClick={() => void onDownload()}>
        Download interview report
      </Button>
    </CandidateShell>
  );
}
