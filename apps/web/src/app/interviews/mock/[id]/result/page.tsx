'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession, LiveInterviewQuestion } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { Button } from '@/components/ui/Button';
import { downloadInterviewReport, endLiveInterview, getInterview } from '@/lib/api';
import {
  formatInterviewAnswerDisplay,
  isAnsweredInterviewQuestion,
  shouldShowBetterAnswer,
} from '@/lib/interview-answer-display';

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 flex-1 font-semibold text-slate-700">{label}</span>
      <span className="shrink-0 font-extrabold text-slate-900">{value}%</span>
    </div>
  );
}

function questionScoreOutOf10(score?: number) {
  if (score == null) return '—';
  return `${scoreOutOf10(score)}/10`;
}

function scoreOutOf10(score?: number) {
  if (score == null) return 0;
  return Math.max(0, Math.min(10, Math.round(score / 10)));
}

function averageScore(questions: LiveInterviewQuestion[]) {
  if (!questions.length) return 0;
  return Math.round(questions.reduce((sum, item) => sum + (item.score || 0), 0) / questions.length);
}

function averageScoreOutOf10(questions: LiveInterviewQuestion[]) {
  if (!questions.length) return 0;
  return Math.round(
    questions.reduce((sum, item) => sum + scoreOutOf10(item.score), 0) / questions.length,
  );
}

function technicalAverage(questions: LiveInterviewQuestion[]) {
  const technical = questions.filter(
    (item) =>
      item.score != null && /TECHNICAL|PROJECT|EDUCATION|EXPERIENCE|RESUME/i.test(item.category || ''),
  );
  if (!technical.length) return null;
  return Math.round(technical.reduce((sum, item) => sum + (item.score || 0), 0) / technical.length);
}

function problemSolvingAverage(questions: LiveInterviewQuestion[]) {
  const relevant = questions.filter(
    (item) =>
      item.score != null && /SCENARIO|PROBLEM|FOLLOW_UP|BEHAVIOURAL|ROLE/i.test(item.category || ''),
  );
  if (!relevant.length) return null;
  return Math.round(relevant.reduce((sum, item) => sum + (item.score || 0), 0) / relevant.length);
}

function roleAverage(questions: LiveInterviewQuestion[]) {
  const relevant = questions.filter(
    (item) => item.score != null && /ROLE|EXPERIENCE|INTRO|READINESS/i.test(item.category || ''),
  );
  if (!relevant.length) return null;
  return Math.round(relevant.reduce((sum, item) => sum + (item.score || 0), 0) / relevant.length);
}

function scaleTenToPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return null;
  // Backend stores communication/behaviour/listening as 1–10.
  const n = Number(value);
  if (n <= 10) return Math.max(0, Math.min(100, Math.round(n * 10)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function MockInterviewResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let next = await getInterview(params.id);
        if (next.status !== 'COMPLETED') {
          next = await endLiveInterview(params.id);
        }
        if (!cancelled) setSession(next);
      } catch {
        if (!cancelled) router.replace('/interviews/mock');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const answeredQuestions = useMemo(
    () => (session?.liveQuestions || []).filter(isAnsweredInterviewQuestion),
    [session],
  );

  const metrics = useMemo(() => {
    if (!session?.report) return null;
    const report = session.report;
    const questionAvg = averageScore(answeredQuestions);
    // Overall stays the exact average of per-question scores.
    const overall = answeredQuestions.length ? questionAvg : report.overallScore;
    const overallOutOf10 = answeredQuestions.length
      ? averageScoreOutOf10(answeredQuestions)
      : Math.round(overall / 10);

    const technical = technicalAverage(answeredQuestions);
    const problemSolving = problemSolvingAverage(answeredQuestions);
    const roleReadiness = roleAverage(answeredQuestions);

    // Use distinct backend dimension scores (1–10 → %) so rows are not all identical.
    const communication =
      scaleTenToPercent(session.communicationScore ?? report.communication) ?? overall;
    const confidence =
      scaleTenToPercent(session.listeningScore ?? report.listening) ?? overall;
    const behaviourPct =
      scaleTenToPercent(session.behaviourScore ?? report.behaviour) ?? overall;

    return {
      overall,
      overallOutOf10,
      communication,
      technical: technical ?? Math.round((communication + overall) / 2),
      problemSolving: problemSolving ?? Math.round((behaviourPct + overall) / 2),
      roleReadiness: roleReadiness ?? behaviourPct,
      confidence,
      strengths: report.strengths,
      improvements: report.weaknesses,
      recommendation: report.recommendation,
      summary: report.summary,
    };
  }, [session, answeredQuestions]);

  async function onDownload() {
    if (!session) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const file = await downloadInterviewReport(session.id);
      const bytes = Uint8Array.from(atob(file.pdf), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.mimeType || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName || 'interview-report.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !session || !metrics) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-2">
          <InterviewBotFace size="lg" speaking />
          <p className="text-sm font-semibold text-slate-500">Preparing your results...</p>
        </div>
      </CandidateAppShell>
    );
  }

  const actionButtons = (
    <>
      <Link href="/interviews/mock" className="w-full sm:w-auto">
        <Button type="button" variant="outline" className="w-full !rounded-full sm:min-w-[160px]">
          Try Again
        </Button>
      </Link>
      <Button
        type="button"
        loading={downloading}
        loadingLabel="Downloading..."
        className="w-full !rounded-full sm:min-w-[180px]"
        onClick={() => void onDownload()}
      >
        Download Report
      </Button>
    </>
  );

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-36 sm:space-y-6 sm:pb-10">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:p-8">
          <div className="flex justify-center">
            <InterviewBotFace size="lg" className="sm:hidden" />
            <InterviewBotFace size="xl" className="hidden sm:inline-flex" />
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:mt-3 sm:text-xs">
            AI Mock Interview Result
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:mt-2 sm:text-2xl">
            Your Interview Report
          </h1>

          <div className="mt-4 sm:mt-6">
            <p className="text-4xl font-black text-[#0a2e2c] sm:text-5xl">{metrics.overallOutOf10}/10</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">
              Overall · {metrics.overall}/100
            </p>
          </div>

          <div className="mt-5 space-y-2.5 text-left sm:mt-8 sm:space-y-3">
            <ScoreRow label="Communication" value={metrics.communication} />
            <ScoreRow label="Technical Knowledge" value={metrics.technical} />
            <ScoreRow label="Problem Solving" value={metrics.problemSolving} />
            <ScoreRow label="Role Readiness" value={metrics.roleReadiness} />
            <ScoreRow label="Confidence" value={metrics.confidence} />
          </div>
        </article>

        <section className="space-y-2 sm:space-y-3">
          <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">Overall analysis</h2>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm leading-relaxed break-words text-slate-600">{metrics.summary}</p>
            <p className="mt-3 text-sm font-bold text-[#0a2e2c]">
              Recommendation: {metrics.recommendation}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-900">Key strengths</h2>
          <ul className="mt-3 space-y-2">
            {metrics.strengths.map((item) => (
              <li key={item} className="break-words text-sm font-semibold text-emerald-800">
                ✓ {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-900">Areas to improve</h2>
          <ul className="mt-3 space-y-2">
            {metrics.improvements.map((item) => (
              <li key={item} className="break-words text-sm font-semibold text-slate-600">
                ○ {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 sm:space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">Question-wise review</h2>
          {answeredQuestions.map((item, index) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-2.5 sm:gap-3">
                <InterviewBotFace size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Question {index + 1}
                    </p>
                    <p className="text-sm font-extrabold text-[#0a2e2c]">
                      Score: {questionScoreOutOf10(item.score)}
                    </p>
                  </div>
                  <p className="mt-2 break-words text-sm font-bold text-slate-900">{item.text}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-slate-800">Your answer</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">
                    {formatInterviewAnswerDisplay(item)}
                  </p>
                </div>
                {item.analysis ? (
                  <div>
                    <p className="font-bold text-slate-800">AI analysis</p>
                    <p className="mt-1 break-words text-slate-600">{item.analysis}</p>
                  </div>
                ) : null}
                {shouldShowBetterAnswer(item) ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 sm:px-4">
                    <p className="font-bold text-emerald-900">Improved answer</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-emerald-900">
                      {item.improvedAnswer}
                    </p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        {downloadError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">
            {downloadError}
          </p>
        ) : null}

        {/* Desktop actions */}
        <div className="hidden gap-3 sm:flex sm:justify-center">{actionButtons}</div>
      </div>

      {/* Mobile sticky actions — above bottom nav */}
      <div className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-2xl gap-2">{actionButtons}</div>
      </div>
    </CandidateAppShell>
  );
}
