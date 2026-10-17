'use client';

import { useState } from 'react';
import AtsAnalysisPanel from '@/components/AtsAnalysisPanel.jsx';
import { analyzeResumeRole, rewriteResumeRole } from '@/lib/api';

export function RoleAtsChecker({
  resumeId,
  templateId,
  defaultRole,
}: {
  resumeId: string;
  templateId?: string | null;
  defaultRole?: string | null;
}) {
  const [targetRole, setTargetRole] = useState(defaultRole || '');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [rewriteError, setRewriteError] = useState('');
  const [rewriteResult, setRewriteResult] = useState<Record<string, unknown> | null>(null);
  const [viewingRewrite, setViewingRewrite] = useState(false);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  async function onAnalyze() {
    setAnalyzing(true);
    setError('');
    setRewriteResult(null);
    setViewingRewrite(false);
    try {
      if (analysis && typeof analysis.overallScore === 'number') {
        setPreviousScore(analysis.overallScore);
      }
      const next = await analyzeResumeRole({
        resumeId,
        targetRole,
        jobDescription,
        templateId: templateId || undefined,
      });
      setAnalysis(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze this resume.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function onRewrite() {
    setRewriting(true);
    setRewriteError('');
    try {
      const next = await rewriteResumeRole({
        resumeId,
        targetRole,
        jobDescription,
        templateId: templateId || undefined,
        analysis,
      });
      setRewriteResult(next);
      setViewingRewrite(true);
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : 'Could not rewrite this resume.');
    } finally {
      setRewriting(false);
    }
  }

  return (
    <AtsAnalysisPanel
      targetRole={targetRole}
      jobDescription={jobDescription}
      onTargetRole={setTargetRole}
      onJobDescription={setJobDescription}
      onAnalyze={() => void onAnalyze()}
      analyzing={analyzing}
      analysis={analysis}
      error={error}
      stale={false}
      previousScore={previousScore}
      onRewrite={() => void onRewrite()}
      rewriting={rewriting}
      rewriteError={rewriteError}
      rewriteResult={rewriteResult}
      viewingRewrite={viewingRewrite}
      onViewRewrite={setViewingRewrite}
      onApplyRewrite={() => setViewingRewrite(false)}
      onCancelRewrite={() => {
        setViewingRewrite(false);
        setRewriteResult(null);
      }}
      onUndoRewrite={() => undefined}
      canUndo={false}
    />
  );
}
