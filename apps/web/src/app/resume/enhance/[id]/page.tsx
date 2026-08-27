'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ATS_ENHANCE_PLANS, type ResumeRecord } from '@careerbridge/shared';
import { downloadResume, enhanceResume, getResume, startResumeOptimization } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { ResumePaper } from '@/components/ResumePaper';
import { AtsResumeSheet } from '@/components/AtsResumeSheet';
import { RoleAtsChecker } from '@/components/RoleAtsChecker';
import { ScoreRing } from '@/components/ScoreRing';
import { Button } from '@/components/ui/Button';

type OptResult = {
  id: string;
  sourceResumeId: string;
  resultResumeId: string | null;
  beforeScore: number;
  afterScore: number | null;
  improvement: number | null;
  factPreservation: number | null;
  improvements: string[];
  targetLabel: string;
  changes: Array<{
    section: string;
    originalText: string;
    suggestedText: string;
    reason: string;
    validation: string;
  }>;
};

export default function ResumeEnhanceResultPage() {
  const params = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [optimized, setOptimized] = useState<ResumeRecord | null>(null);
  const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opt, setOpt] = useState<OptResult | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    enhanceResume(params.id)
      .then(setResume)
      .catch(() => setError('We could not check ATS Readiness for this resume.'));
  }, [params.id]);

  const analysis = resume?.analysis;
  const score = analysis?.score ?? resume?.score ?? 0;
  const plans = resume?.plans?.length ? resume.plans : ATS_ENHANCE_PLANS;
  const recommended = analysis?.recommendedPlanId || plans[2]?.id;

  const afterResume = useMemo(() => optimized || resume, [optimized, resume]);
  const problemSnippets = useMemo(() => {
    const fromIssues = (analysis?.issues || [])
      .flatMap((item) => [item.originalExample, item.location, item.problem])
      .filter((item): item is string => Boolean(item && item.length > 4));
    const fromChanges = (opt?.changes || []).map((item) => item.originalText).filter((item) => item.length > 3);
    return [...new Set([...fromIssues, ...fromChanges])];
  }, [analysis?.issues, opt?.changes]);
  const problemSections = useMemo(
    () => [...new Set((analysis?.issues || []).map((item) => item.sectionKey))],
    [analysis?.issues],
  );

  async function runOptimize() {
    if (!selected || !resume) return;
    setBusy(true);
    setError('');
    try {
      const result = await startResumeOptimization(resume.id, selected);
      setOpt(result);
      setPlansOpen(false);
      if (result.resultResumeId) {
        const next = await getResume(result.resultResumeId);
        setOptimized(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization could not finish.');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(id: string, title: string) {
    const file = await downloadResume(id);
    const bytes = Uint8Array.from(atob(file.pdf || ''), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: file.mimeType || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName || `${title}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !resume) {
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
        <p className="text-muted">Generating your ATS Readiness report...</p>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">ATS Resume Analyzer</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{resume.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {analysis?.disclaimer ||
          'ATS Readiness Score measures parsing and resume quality. It is not a Job Match Score.'}
      </p>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      {opt && opt.afterScore != null ? (
        <section className="cb-enhance-after mt-6">
          <div className="cb-enhance-after-scores">
            <div>
              <p className="cb-enhance-kicker">Before</p>
              <p className="cb-enhance-big">{opt.beforeScore} / 100</p>
            </div>
            <div>
              <p className="cb-enhance-kicker">After</p>
              <p className="cb-enhance-big">{opt.afterScore} / 100</p>
            </div>
            <div>
              <p className="cb-enhance-kicker">Improvement</p>
              <p className="cb-enhance-big">
                {opt.improvement != null && opt.improvement >= 0 ? '+' : ''}
                {opt.improvement}
              </p>
            </div>
            <div>
              <p className="cb-enhance-kicker">Fact preservation</p>
              <p className="cb-enhance-big">
                {opt.factPreservation ?? 100}% { (opt.factPreservation ?? 100) >= 98 ? '✓' : '' }
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-1">
            {opt.improvements.map((item) => (
              <li key={item} className="text-sm font-semibold text-primary">
                ✓ {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            Paid target was “{opt.targetLabel}”. The score is from real improvements only — it is never moved to match a package.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowChanges((value) => !value)}>
              View changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCompare((value) => !value)}>
              Compare resume
            </Button>
            {opt.resultResumeId ? (
              <Button type="button" onClick={() => void onDownload(opt.resultResumeId!, 'optimized-resume')}>
                Download optimized resume
              </Button>
            ) : null}
          </div>
          {showChanges ? (
            <div className="mt-4 space-y-3">
              {opt.changes
                .filter((item) => item.validation === 'PASS')
                .map((item, index) => (
                  <article key={`${item.originalText}-${index}`} className="cb-enhance-change">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">{item.section}</p>
                    <p className="mt-2 text-sm text-muted">Original: {item.originalText}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">New: {item.suggestedText}</p>
                    <p className="mt-1 text-xs text-muted">{item.reason} · {item.validation}</p>
                  </article>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="cb-enhance-split">
        <div className="cb-resume-desk min-w-0">
          <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            {compare && optimized ? 'Original vs optimized' : 'Your resume'}
          </p>
          {compare && optimized ? (
            <div className="cb-enhance-compare">
              <div>
                <p className="cb-enhance-compare-label is-problem">Original — problems in red</p>
                <ResumePaper
                  content={resume.content}
                  summary={resume.summary || resume.content.summary}
                  targetJobTitle={resume.targetJobTitle}
                  highlightSnippets={problemSnippets}
                  problemSections={problemSections}
                />
              </div>
              <div>
                <p className="cb-enhance-compare-label">Optimized</p>
                <ResumePaper
                  content={optimized.content}
                  summary={optimized.summary || optimized.content.summary}
                  targetJobTitle={optimized.targetJobTitle}
                />
              </div>
            </div>
          ) : (
            <ResumePaper
              content={afterResume!.content}
              summary={afterResume!.summary || afterResume!.content.summary}
              targetJobTitle={afterResume!.targetJobTitle}
              highlightSnippets={optimized ? [] : problemSnippets}
              problemSections={optimized ? [] : problemSections}
            />
          )}
          <div className="mt-6 overflow-hidden rounded-2xl bg-white p-3 shadow">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              Selected template preview
            </p>
            <AtsResumeSheet
              content={afterResume!.content}
              template={afterResume!.template}
              withPhoto={afterResume!.content.includePhoto !== false && afterResume!.template?.startsWith('photo-')}
              targetJobTitle={afterResume!.targetJobTitle}
            />
          </div>
          <div className="mt-6">
            <RoleAtsChecker
              resumeId={resume!.id}
              templateId={resume!.template}
              defaultRole={resume!.targetJobTitle}
            />
          </div>
        </div>

        <aside className="cb-enhance-score">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-error">These are the problems</p>
          <p className="mt-1 text-sm text-muted">
            {analysis?.highPriority || 0} high · {analysis?.mediumPriority || 0} medium. Fix these first.
          </p>
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-auto pr-1">
            {(analysis?.issues || []).length ? (
              (analysis?.issues || []).map((item) => (
                <article key={item.id} className={`cb-enhance-issue is-${item.severity.toLowerCase()}`}>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-error">
                    {item.section} · {item.severity === 'HIGH' ? 'High priority' : 'Medium'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-error">Problem: {item.problem}</p>
                  <p className="mt-1 text-xs text-[#7f1d1d]">Where: {item.location}</p>
                  <p className="mt-1 text-xs text-[#7f1d1d]">Why: {item.why}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">How to improve: {item.recommendation}</p>
                  {item.originalExample ? (
                    <p className="mt-2 text-xs">
                      <mark className="cb-resume-mark">{item.originalExample}</mark>
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-muted">No major problems were found on this resume.</p>
            )}
          </div>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-teal">ATS Readiness Score</p>
          <div className="mt-4 flex justify-center">
            <ScoreRing value={optimized?.score ?? score} size={140} label="Ready" />
          </div>
          <p className="mt-3 text-center text-lg font-extrabold text-primary">
            {(optimized?.analysis?.label || analysis?.label) ?? ''} · {(optimized?.score ?? score)} / 100
          </p>
          <p className="mt-1 text-center text-sm text-muted">No job description required</p>

          <div className="cb-enhance-counts">
            <span>High priority: {analysis?.highPriority ?? 0}</span>
            <span>Medium: {analysis?.mediumPriority ?? 0}</span>
            <span>Good sections: {analysis?.goodSections ?? 0}</span>
          </div>

          <div className="mt-5 space-y-2">
            {(analysis?.sections || []).map((item) => (
              <div key={item.key} className="cb-enhance-section-row">
                <span>{item.name}</span>
                <strong className={`is-${item.tone}`}>
                  {item.score} {item.tone === 'good' ? '🟢' : item.tone === 'warn' ? '🟡' : '🔴'}
                </strong>
              </div>
            ))}
          </div>

          <Button className="mt-6" type="button" onClick={() => setPlansOpen(true)}>
            Improve my resume
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm font-bold text-teal hover:underline"
            onClick={() => void onDownload(resume.id, resume.title)}
          >
            Download original
          </button>
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
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal">Choose a target</p>
                <h2 id="ats-plans-title" className="mt-1 text-xl font-extrabold text-primary">
                  Improve my resume
                </h2>
                <p className="mt-1 text-sm text-muted">
                  We optimize toward a range. We never guarantee that exact score, and we never inflate the number to match payment.
                </p>
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
                  className={`cb-enhance-plan${selected === plan.id ? ' is-selected' : ''}${
                    plan.id === recommended ? ' is-recommended' : ''
                  }`}
                  onClick={() => setSelected(plan.id)}
                >
                  <span>
                    <span className="cb-enhance-plan-label">{plan.label}</span>
                    {plan.id === recommended ? <em className="cb-enhance-star"> Recommended</em> : null}
                  </span>
                  <strong>₹{plan.amount}</strong>
                </button>
              ))}
            </div>

            <Button type="button" disabled={!selected || busy} onClick={() => void runOptimize()}>
              {busy
                ? 'Optimizing...'
                : selected
                  ? `Optimize toward range · ₹${plans.find((item) => item.id === selected)?.amount} (payment coming soon)`
                  : 'Select a plan'}
            </Button>
          </div>
        </div>
      ) : null}
    </CandidateShell>
  );
}
