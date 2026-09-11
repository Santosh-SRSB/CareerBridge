'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { AudioAnswerRecorder } from '@/components/marketplace/AudioAnswerRecorder';
import { Button } from '@/components/ui/Button';
import { answerLiveInterview, endLiveInterview, getInterview, startLiveInterview } from '@/lib/api';

function interviewTypeLabel(type: string) {
  if (type === 'BEHAVIOURAL' || type === 'GENERIC') return 'Generic';
  if (type === 'ROLE' || type === 'ROLE_BASED') return 'Role-Based';
  return type;
}

export default function MockInterviewQuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const answerBoxRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitAreaRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioDurationSec, setAudioDurationSec] = useState<number | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBooting(true);
      try {
        let next = await getInterview(params.id);
        if (!next.startAt) {
          next = await startLiveInterview(params.id);
        }
        if (cancelled) return;
        if (next.status === 'COMPLETED') {
          router.replace(`/interviews/mock/${params.id}/result`);
          return;
        }
        setSession(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not start interview.');
          router.replace('/interviews/mock');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  useEffect(() => {
    const box = answerBoxRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [answer, isRecording]);

  function resetAnswerFields() {
    setAnswer('');
    setHasAudio(false);
    setAudioDurationSec(undefined);
    setIsRecording(false);
    setError('');
  }

  function scrollToSubmitArea() {
    window.setTimeout(() => {
      submitAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 120);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session?.currentQuestion) return;

    const textAnswer = answer.trim();
    if (textAnswer.length < 8 && !hasAudio) {
      setError('Type your answer or record an audio response.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const answerMode: 'TEXT' | 'AUDIO' = textAnswer.length >= 8 ? 'TEXT' : 'AUDIO';
      let next = await answerLiveInterview(
        params.id,
        textAnswer || '(audio answer recorded)',
        audioDurationSec,
        answerMode,
      );

      if (next.conductWarning && !next.conductTerminated) {
        setError(next.conductWarning);
        setSession(next);
        return;
      }

      const finished = next.status === 'COMPLETED' || Boolean(next.conductTerminated);
      if (finished) {
        if (!next.report) {
          next = await endLiveInterview(params.id);
        }
        router.push(`/interviews/mock/${params.id}/result`);
        return;
      }

      // No per-question score popup — move straight to the next question.
      setSession(next);
      resetAnswerFields();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (booting || !session) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-2">
          <InterviewBotFace size="lg" speaking />
          <p className="text-sm font-semibold text-slate-500">Loading interview...</p>
        </div>
      </CandidateAppShell>
    );
  }

  const questionNumber = session.questionIndex + 1;
  const questionText = session.currentQuestion?.prompt || '';
  const savedCount = (session.liveQuestions || []).filter((item) => item.answer?.trim()).length;
  const progressPct = Math.min(100, Math.round((savedCount / Math.max(session.totalQuestions, 1)) * 100));

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-3 pb-28 sm:space-y-5 sm:pb-8">
        <Link
          href="/interviews/mock"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a2e2c] sm:text-sm"
        >
          <span aria-hidden>←</span>
          <span>Setup</span>
        </Link>

        {/* Compact text header + bot (no green bar) */}
        <header className="flex items-center gap-2.5 sm:gap-4">
          <InterviewBotFace size="sm" speaking={isRecording || loading} className="sm:hidden" />
          <InterviewBotFace size="md" speaking={isRecording || loading} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
              AI Mock Interview
            </p>
            <h1 className="truncate text-sm font-extrabold text-[#0a2e2c] sm:text-xl">{session.jobRole}</h1>
            <p className="text-xs text-slate-600 sm:text-sm">
              {interviewTypeLabel(session.interviewType)} · Q {questionNumber}/{session.totalQuestions}
            </p>
            <div className="mt-1.5 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-slate-200 sm:mt-2 sm:max-w-xs">
              <div
                className="h-full rounded-full bg-[#0a2e2c] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </header>

        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full items-center justify-start gap-1.5 sm:flex-wrap sm:justify-center sm:gap-2">
            {Array.from({ length: session.totalQuestions }, (_, index) => {
              const isSaved = index < savedCount;
              const isCurrent = index === session.questionIndex;
              return (
                <span
                  key={index}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition sm:h-8 sm:w-8 sm:text-xs ${
                    isSaved
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isCurrent
                        ? 'bg-[#0a2e2c] text-white ring-2 ring-[#0a2e2c]/25 ring-offset-1'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isSaved ? '✓' : index + 1}
                </span>
              );
            })}
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(10,46,44,0.08)]">
          <div className="border-b border-slate-100 bg-[#f4faf9] px-3.5 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3">
              <InterviewBotFace size="sm" speaking={loading} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2e2c]/70 sm:text-xs">
                  AI Interviewer
                </p>
                <blockquote className="mt-1.5 break-words text-[15px] font-bold leading-snug text-slate-900 sm:text-lg sm:leading-relaxed">
                  {questionText}
                </blockquote>
              </div>
            </div>
          </div>

          <form
            ref={formRef}
            onSubmit={(event) => void onSubmit(event)}
            className="space-y-3.5 p-3.5 sm:space-y-4 sm:p-5"
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="mock-answer" className="text-sm font-bold text-slate-800">
                  Your answer
                </label>
                {isRecording ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    Live
                  </span>
                ) : hasAudio ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Audio saved
                  </span>
                ) : null}
              </div>
              <textarea
                ref={answerBoxRef}
                id="mock-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={
                  isRecording
                    ? 'Listening… speech appears here live'
                    : 'Type here, or record and watch speech appear live…'
                }
                rows={5}
                disabled={loading}
                className={`min-h-[120px] w-full resize-y rounded-xl border bg-[#fbfcfc] px-3 py-2.5 text-[15px] leading-6 text-slate-800 outline-none transition focus:bg-white focus:ring-2 disabled:opacity-60 sm:min-h-[160px] sm:px-3.5 sm:py-3 sm:text-sm sm:leading-7 ${
                  isRecording
                    ? 'border-red-200 ring-2 ring-red-100'
                    : 'border-slate-200 ring-[#0a2e2c] focus:ring-[#0a2e2c]/30'
                }`}
              />
            </div>

            <AudioAnswerRecorder
              key={`recorder-q-${session.questionIndex}`}
              disabled={loading}
              onLiveTranscript={(text) => setAnswer(text)}
              onRecordingChange={(recording) => {
                setIsRecording(recording);
                if (recording) scrollToSubmitArea();
              }}
              onRecorded={({ durationSec, transcript }) => {
                setHasAudio(true);
                setAudioDurationSec(durationSec);
                if (transcript?.trim()) setAnswer(transcript.trim());
                scrollToSubmitArea();
              }}
              onClear={() => {
                setHasAudio(false);
                setAudioDurationSec(undefined);
              }}
            />

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600 sm:text-sm">
                {error}
              </p>
            ) : null}

            <div ref={submitAreaRef} id="mock-submit-area" className="flex justify-center pt-1">
              <Button
                type="submit"
                loading={loading}
                loadingLabel="Your answer is analysing, please wait — almost done"
                disabled={isRecording}
                block={false}
                className="w-full !rounded-full !py-3 sm:w-auto sm:min-w-[260px] sm:!px-8"
              >
                Submit Answer
              </Button>
            </div>
          </form>
        </article>
      </div>
    </CandidateAppShell>
  );
}
