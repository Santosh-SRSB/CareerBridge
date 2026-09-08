'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
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
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioDurationSec, setAudioDurationSec] = useState<number | undefined>();
  const [audioTranscript, setAudioTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

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
      } catch {
        if (!cancelled) router.replace('/interviews/mock');
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
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  function resetAnswerFields() {
    setAnswer('');
    setHasAudio(false);
    setAudioDurationSec(undefined);
    setAudioTranscript('');
    setError('');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session?.currentQuestion) return;

    const trimmed = answer.trim();
    const spokenText = audioTranscript.trim();
    const textAnswer = trimmed || spokenText;

    if (textAnswer.length < 8 && !hasAudio) {
      setError('Type your answer or record an audio response.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const answeredNumber = session.questionIndex + 1;
      const answerMode: 'TEXT' | 'AUDIO' = textAnswer.length >= 8 ? 'TEXT' : 'AUDIO';
      let next = await answerLiveInterview(
        params.id,
        textAnswer,
        audioDurationSec,
        answerMode,
      );

      if (next.status === 'COMPLETED') {
        if (!next.report) {
          next = await endLiveInterview(params.id);
        }
        router.push(`/interviews/mock/${params.id}/result`);
        return;
      }

      setSaveNotice(`${answeredNumber}/${next.totalQuestions} successfully recorded and saved`);
      setSession(next);
      resetAnswerFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (booting || !session) {
    return (
      <CandidateAppShell activeTab="interviews">
        <p className="text-slate-500">Loading interview...</p>
      </CandidateAppShell>
    );
  }

  const questionNumber = session.questionIndex + 1;
  const questionText = session.currentQuestion?.prompt || '';
  const savedCount = (session.liveQuestions || []).filter((item) => item.answer?.trim()).length;

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/interviews/mock" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← Mock Interview Setup
        </Link>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-bold text-slate-800">AI Mock Interview</p>
          <p className="mt-1 text-slate-600">
            <span className="font-semibold">Job Role:</span> {session.jobRole}
          </p>
          <p className="text-slate-600">
            <span className="font-semibold">Interview Type:</span> {interviewTypeLabel(session.interviewType)}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-600">
            Question {questionNumber} of {session.totalQuestions}
          </p>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: session.totalQuestions }, (_, index) => {
              const isSaved = index < savedCount;
              const isCurrent = index === session.questionIndex;
              return (
                <span
                  key={index}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-extrabold ${
                    isSaved
                      ? 'bg-emerald-100 text-emerald-800'
                      : isCurrent
                        ? 'bg-[#0a2e2c] text-white'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isSaved ? '✓' : index + 1}
                </span>
              );
            })}
          </div>
        </div>

        {saveNotice ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
            role="status"
            aria-live="polite"
          >
            ✓ {saveNotice}
          </div>
        ) : null}

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI Interviewer</p>
          <blockquote className="mt-2 text-lg font-bold leading-relaxed text-slate-900">
            &ldquo;{questionText}&rdquo;
          </blockquote>

          <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="mock-answer" className="mb-2 block text-sm font-bold text-slate-800">
                Candidate Response
              </label>
              <textarea
                id="mock-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer..."
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-7 text-slate-800 outline-none ring-[#0a2e2c] focus:ring-2"
              />
            </div>

            <AudioAnswerRecorder
              key={`recorder-q-${session.questionIndex}`}
              disabled={loading}
              onRecorded={({ durationSec, transcript }) => {
                setHasAudio(true);
                setAudioDurationSec(durationSec);
                setAudioTranscript(transcript || '');
                if (transcript?.trim() && !answer.trim()) {
                  setAnswer(transcript.trim());
                }
              }}
              onClear={() => {
                setHasAudio(false);
                setAudioDurationSec(undefined);
                setAudioTranscript('');
              }}
            />

            {hasAudio && audioTranscript ? (
              <p className="text-xs font-semibold text-slate-500">
                Speech captured from your recording. You can edit the text above before submitting.
              </p>
            ) : hasAudio ? (
              <p className="text-xs font-semibold text-slate-500">
                Audio recorded. Add a short written summary above for the best AI feedback.
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" loading={loading} loadingLabel="Submitting..." className="w-full sm:w-auto">
              Submit Answer
            </Button>
          </form>
        </article>
      </div>
    </CandidateAppShell>
  );
}
