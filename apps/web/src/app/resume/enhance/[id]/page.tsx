'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ATS_ENHANCE_PLANS, type ResumeRecord } from '@careerbridge/shared';
import { enhanceResume } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { ResumePaper } from '@/components/ResumePaper';
import { ScoreRing } from '@/components/ScoreRing';
import { Button } from '@/components/ui/Button';

export default function ResumeEnhanceResultPage() {
  const params = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    enhanceResume(params.id)
      .then(setResume)
      .catch(() => setError('We could not check the ATS score for this resume.'));
  }, [params.id]);

  if (error) {
    return (
      <CandidateShell>
        <p className="text-error">{error}</p>
        <Link href="/resume/enhance" className="mt-4 inline-flex font-bold text-teal hover:underline">
          Drop another resume
        </Link>
      </CandidateShell>
    );
  }

  if (!resume) {
    return (
      <CandidateShell>
        <p className="text-muted">Checking ATS score...</p>
      </CandidateShell>
    );
  }

  const analysis = resume.analysis;
  const score = analysis?.score ?? resume.score;
  const plans = ATS_ENHANCE_PLANS;

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Resume enhancement</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{resume.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">Your uploaded resume is saved. Review the ATS score, then pick a plan to improve it.</p>

      <div className="cb-enhance-split">
        <div className="cb-resume-desk min-w-0">
          <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Your resume</p>
          <ResumePaper content={resume.content} summary={resume.summary || resume.content.summary} targetJobTitle={resume.targetJobTitle} />
        </div>

        <aside className="cb-enhance-score">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal">ATS score</p>
          <div className="mt-4 flex justify-center">
            <ScoreRing value={score} size={140} label="ATS" />
          </div>
          <p className="mt-3 text-center text-sm text-muted">Current match for applicant tracking systems</p>

          {analysis?.complete.length ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-success">Looking good</p>
              <ul className="mt-2 space-y-1">
                {analysis.complete.map((item) => (
                  <li key={item} className="text-sm font-semibold text-primary">
                    ✓ {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis?.improve.length ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-warning">Needs work</p>
              <ul className="mt-2 space-y-1">
                {analysis.improve.map((item) => (
                  <li key={item} className="text-sm font-semibold text-primary">
                    ⚠ {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button className="mt-6" type="button" onClick={() => setPlansOpen(true)}>
            Improve your resume ATS score
          </Button>
          <Link href="/resume/enhance" className="mt-3 block text-center text-sm font-bold text-teal hover:underline">
            Upload another resume
          </Link>
        </aside>
      </div>

      {plansOpen ? (
        <div className="cb-enhance-modal" role="dialog" aria-labelledby="ats-plans-title">
          <button type="button" className="cb-enhance-modal-backdrop" aria-label="Close" onClick={() => setPlansOpen(false)} />
          <div className="cb-enhance-modal-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal">Choose a plan</p>
                <h2 id="ats-plans-title" className="mt-1 text-xl font-extrabold text-primary">
                  Improve your resume ATS score
                </h2>
                <p className="mt-1 text-sm text-muted">Pick the score range you want to reach.</p>
              </div>
              <button type="button" className="cb-enhance-close" onClick={() => setPlansOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="cb-enhance-plans">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`cb-enhance-plan${selected === plan.id ? ' is-selected' : ''}`}
                  onClick={() => setSelected(plan.id)}
                >
                  <span className="cb-enhance-plan-label">{plan.label}</span>
                  <strong>₹{plan.amount}</strong>
                </button>
              ))}
            </div>

            <Button type="button" disabled={!selected}>
              {selected ? `Continue · ₹${plans.find((item) => item.id === selected)?.amount}` : 'Select a plan'}
            </Button>
          </div>
        </div>
      ) : null}
    </CandidateShell>
  );
}
