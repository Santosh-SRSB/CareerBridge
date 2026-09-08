'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession, LiveInterviewQuestion } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { endLiveInterview, getInterview } from '@/lib/api';
import {
  formatInterviewAnswerDisplay,
  isAnsweredInterviewQuestion,
  shouldShowBetterAnswer,
} from '@/lib/interview-answer-display';

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="font-extrabold text-slate-900">{value}%</span>
    </div>
  );
}

function questionScoreOutOf10(score?: number) {
  if (score == null) return '—';
  return `${Math.round(score / 10)}/10`;
}

function technicalAverage(questions: LiveInterviewQuestion[]) {
  const technical = questions.filter(
    (item) => item.answer?.trim() && /TECHNICAL|PROJECT|SCENARIO|PROBLEM/i.test(item.category),
  );
  if (!technical.length) return null;
  return Math.round(technical.reduce((sum, item) => sum + (item.score || 0), 0) / technical.length);
}

function problemSolvingAverage(questions: LiveInterviewQuestion[]) {
  const relevant = questions.filter(
    (item) => item.answer?.trim() && /SCENARIO|PROBLEM|FOLLOW_UP|TECHNICAL/i.test(item.category),
  );
  if (!relevant.length) return null;
  return Math.round(relevant.reduce((sum, item) => sum + (item.score || 0), 0) / relevant.length);
}

export default function MockInterviewResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

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
    const technical = technicalAverage(answeredQuestions);
    const problemSolving = problemSolvingAverage(answeredQuestions);
    return {
      overall: report.overallScore,
      communication: report.communication * 10,
      technical: technical ?? report.overallScore,
      problemSolving: problemSolving ?? report.overallScore,
      roleReadiness: report.overallScore,
      confidence: report.listening * 10,
      strengths: report.strengths,
      improvements: report.weaknesses,
      recommendation: report.recommendation,
      summary: report.summary,
    };
  }, [session, answeredQuestions]);

  if (loading || !session || !metrics) {
    return (
      <CandidateAppShell activeTab="interviews">
        <p className="text-slate-500">Preparing your results...</p>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">AI Mock Interview Result</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Your Interview Report</h1>

          <div className="mt-6">
            <p className="text-5xl font-black text-[#0a2e2c]">{metrics.overall}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide text-slate-500">Overall Score / 100</p>
          </div>

          <div className="mt-8 space-y-3 text-left">
            <ScoreRow label="Communication" value={metrics.communication} />
            <ScoreRow label="Technical Knowledge" value={metrics.technical} />
            <ScoreRow label="Problem Solving" value={metrics.problemSolving} />
            <ScoreRow label="Role Readiness" value={metrics.roleReadiness} />
            <ScoreRow label="Confidence" value={metrics.confidence} />
          </div>

          <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">{metrics.summary}</p>
          <p className="mt-2 text-sm font-bold text-[#0a2e2c]">{metrics.recommendation}</p>
        </article>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Key Strengths</h2>
          <ul className="mt-3 space-y-2">
            {metrics.strengths.map((item) => (
              <li key={item} className="text-sm font-semibold text-emerald-800">
                ✓ {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Areas to Improve</h2>
          <ul className="mt-3 space-y-2">
            {metrics.improvements.map((item) => (
              <li key={item} className="text-sm font-semibold text-slate-600">
                ○ {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">Question-wise Feedback</h2>
          {answeredQuestions.map((item, index) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question {index + 1}</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{item.text}</p>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-slate-800">Candidate Answer</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-600">{formatInterviewAnswerDisplay(item)}</p>
                </div>
                {item.analysis ? (
                  <div>
                    <p className="font-bold text-slate-800">AI Feedback</p>
                    <p className="mt-1 text-slate-600">{item.analysis}</p>
                  </div>
                ) : null}
                <p className="font-extrabold text-[#0a2e2c]">Score: {questionScoreOutOf10(item.score)}</p>
                {shouldShowBetterAnswer(item) ? (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="font-bold text-emerald-900">Suggested Better Answer</p>
                    <p className="mt-1 text-emerald-800">{item.improvedAnswer}</p>
                  </div>
                ) : null}
                {item.weaknesses?.length ? (
                  <div>
                    <p className="font-bold text-slate-800">Improvement Tips</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {item.weaknesses.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/interviews/mock">
            <Button type="button" className="w-full sm:w-auto">
              Try Again
            </Button>
          </Link>
          <Link href="/interviews">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Back to Interviews
            </Button>
          </Link>
        </div>
      </div>
    </CandidateAppShell>
  );
}
