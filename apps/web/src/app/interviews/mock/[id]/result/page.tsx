'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InterviewSession, LiveInterviewQuestion } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import {
  FeedbackReport,
  type FeedbackReportData,
} from '@/components/interviews/FeedbackReport';
import { Button } from '@/components/ui/Button';
import { endLiveInterview, getInterview } from '@/lib/api';
import {
  formatInterviewAnswerDisplay,
  isAnsweredInterviewQuestion,
  shouldShowBetterAnswer,
} from '@/lib/interview-answer-display';
import { getStoredUser } from '@/lib/session';

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
  const n = Number(value);
  if (n <= 10) return Math.max(0, Math.min(100, Math.round(n * 10)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

function percentToTen(value: number | null | undefined) {
  if (value == null) return null;
  return Math.max(0, Math.min(10, Math.round(value / 10)));
}

function formatClock(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(sec?: number | null, startAt?: string | null, endAt?: string | null) {
  let seconds = sec ?? 0;
  if (!seconds && startAt && endAt) {
    const a = new Date(startAt).getTime();
    const b = new Date(endAt).getTime();
    if (!Number.isNaN(a) && !Number.isNaN(b) && b > a) seconds = Math.round((b - a) / 1000);
  }
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return s ? `${m} min ${s}s` : `${m} min`;
}

function statusFromScore(outOf10: number) {
  if (outOf10 >= 9) return 'Excellent';
  if (outOf10 >= 7) return 'Good Performance';
  if (outOf10 >= 6) return 'Above Average';
  if (outOf10 >= 3) return 'Needs Improvement';
  return 'Needs Significant Improvement';
}

export default function MockInterviewResultPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    async function loadOnce(): Promise<InterviewSession | null> {
      let next = await getInterview(params.id);
      if (next.status !== 'COMPLETED' || !next.report) {
        next = await endLiveInterview(params.id);
      }
      return next;
    }

    async function load() {
      setLoading(true);
      setLoadError('');
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        try {
          const next = await loadOnce();
          if (cancelled) return;
          if (!next) {
            setLoadError('Could not load your interview results.');
            setLoading(false);
            return;
          }
          setSession(next);
          if (next.report) {
            setLoading(false);
            return;
          }
          setLoading(true);
          await new Promise((r) => setTimeout(r, 1500));
        } catch (err) {
          if (cancelled) return;
          if (attempts < 6) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          setLoadError(err instanceof Error ? err.message : 'Could not load your interview results.');
          setLoading(false);
          return;
        }
      }
      if (!cancelled) {
        setLoadError('Results are taking longer than usual. Please try again.');
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const answeredQuestions = useMemo(
    () => (session?.liveQuestions || []).filter(isAnsweredInterviewQuestion),
    [session],
  );

  const reportData = useMemo((): FeedbackReportData | null => {
    if (!session?.report) return null;
    const report = session.report;
    const questionAvg = averageScore(answeredQuestions);
    const overall = answeredQuestions.length ? questionAvg : report.overallScore;
    const overallOutOf10 = answeredQuestions.length
      ? averageScoreOutOf10(answeredQuestions)
      : Math.round(overall / 10);

    const communication =
      percentToTen(scaleTenToPercent(session.communicationScore ?? report.communication) ?? overall) ??
      overallOutOf10;
    const technical = percentToTen(
      scaleTenToPercent(report.technicalKnowledge) ?? technicalAverage(answeredQuestions),
    );
    const problemSolving = percentToTen(
      scaleTenToPercent(report.problemSolving) ?? problemSolvingAverage(answeredQuestions),
    );
    const roleReadiness = percentToTen(
      scaleTenToPercent(report.roleReadiness) ??
        roleAverage(answeredQuestions) ??
        scaleTenToPercent(session.behaviourScore ?? report.behaviour),
    );
    const confidence = percentToTen(
      report.confidence != null
        ? scaleTenToPercent(report.confidence)
        : report.confidenceNote
          ? null
          : scaleTenToPercent(session.listeningScore ?? report.listening),
    );

    const skills = [
      { name: 'Communication', score: communication },
      ...(technical != null ? [{ name: 'Technical Knowledge', score: technical }] : []),
      ...(problemSolving != null ? [{ name: 'Problem Solving', score: problemSolving }] : []),
      ...(roleReadiness != null ? [{ name: 'Role Readiness', score: roleReadiness }] : []),
      ...(confidence != null ? [{ name: 'Confidence', score: confidence }] : []),
    ];

    const feedbackPoints = [
      ...(report.strengths || []).map((text) => ({ type: 'good' as const, text })),
      ...(report.weaknesses || []).map((text) => ({ type: 'improve' as const, text })),
    ];

    const user = getStoredUser();
    const candidateName =
      session.candidateName ||
      user?.firstName ||
      'Candidate';

    const duration = formatDuration(session.durationSec, session.startAt, session.endAt);

    return {
      candidate: candidateName,
      role: session.jobRole || 'Interview',
      date: formatDate(session.startAt || session.endAt),
      time: formatClock(session.startAt),
      duration,
      questionsAnswered: `${answeredQuestions.length}/${session.totalQuestions || answeredQuestions.length || report.totalPlanned || 0}`,
      assessedBy: 'Career Bridge AI',
      overallScore: overallOutOf10,
      status: statusFromScore(overallOutOf10),
      joiningTime: formatClock(session.startAt),
      leavingTime: formatClock(session.endAt),
      actualDuration: duration,
      skills,
      feedbackPoints,
      questions: answeredQuestions.map((item, index) => ({
        number: item.number || index + 1,
        score: item.score ?? 0,
        question: item.text,
        answer: formatInterviewAnswerDisplay(item),
        analysis: {
          summary: item.analysis || '',
          missing: item.whatWasMissing || [],
          tip: item.improvementSuggestion || '',
        },
        improvedAnswer: shouldShowBetterAnswer(item) ? item.improvedAnswer || '' : '',
      })),
    };
  }, [session, answeredQuestions]);

  const reportRef = useRef<HTMLDivElement>(null);

  async function onDownload() {
    if (!session || !reportRef.current) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const target = reportRef.current.querySelector('.fr-card') as HTMLElement | null;
      const node = target || reportRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `interview-report-${session.jobRole.replace(/\s+/g, '-') || 'feedback'}.png`;
      link.click();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  }

  if (loadError && !reportData) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <InterviewBotFace size="lg" />
          <p className="text-sm font-semibold text-slate-700">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Try again
            </Button>
            <Link href="/interviews/mock">
              <Button type="button" variant="outline">
                Back to setup
              </Button>
            </Link>
          </div>
        </div>
      </CandidateAppShell>
    );
  }

  if (loading || !session || !reportData) {
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
      <Link href="/feedback?source=AFTER_FIRST_MOCK_INTERVIEW" className="w-full sm:w-auto">
        <Button type="button" variant="secondary" className="w-full !rounded-full sm:min-w-[160px]">
          Share feedback
        </Button>
      </Link>
    </>
  );

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-4xl">
      <div ref={reportRef} className="-mx-4 bg-[#eef0f2] pb-36 sm:-mx-6 sm:pb-10 lg:-mx-8">
        <FeedbackReport
          data={reportData}
          footer={
            <>
              {downloadError ? (
                <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">
                  {downloadError}
                </p>
              ) : null}
              <div className="hidden gap-3 sm:flex sm:justify-center">{actionButtons}</div>
            </>
          }
        />
      </div>

      <div className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-2xl gap-2">{actionButtons}</div>
      </div>
    </CandidateAppShell>
  );
}
