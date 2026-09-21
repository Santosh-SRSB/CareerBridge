'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import {
  AudioAnswerRecorder,
  type AudioAnswerRecorderHandle,
} from '@/components/marketplace/AudioAnswerRecorder';
import { Button } from '@/components/ui/Button';
import {
  buildAnalyzingLine,
  buildGreetingLine,
  buildIntroPlanLine,
  buildIntroStartLine,
  buildQuestionCompletedLines,
  buildRecordStartLine,
  buildThinkLine,
  buildThinkSpokenLine,
} from '@/features/mock-interview/guided-scripts';
import {
  GUIDED_PHASE_LABELS,
  THINK_SECONDS,
  progressSteps,
  type AnswerMethod,
  type GuidedPhase,
} from '@/features/mock-interview/guided-states';
import { cancelGuidedSpeech, speakGuided } from '@/features/mock-interview/guided-voice';
import { answerLiveInterview, endLiveInterview, getInterview, startLiveInterview } from '@/lib/api';
import { subscribeAiSpeech } from '@/features/interview/ai-speech';

function interviewTypeLabel(type: string) {
  if (type === 'BEHAVIOURAL' || type === 'GENERIC') return 'Generic';
  if (type === 'ROLE' || type === 'ROLE_BASED') return 'Role-Based';
  return type;
}

/** Block paste / drop so answers must be typed (or spoken), not copied in. */
function blockClipboardPaste(event: { preventDefault: () => void }) {
  event.preventDefault();
}

export default function MockInterviewQuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const recorderRef = useRef<AudioAnswerRecorderHandle>(null);
  const phaseRunId = useRef(0);
  const questionSpokenForIndex = useRef<number | null>(null);
  const thinkSpokenForIndex = useRef<number | null>(null);
  const completedQuestionNumber = useRef(0);
  const pendingNextPhase = useRef<'QUESTION_DISPLAY' | 'FINAL_PROCESSING'>('QUESTION_DISPLAY');
  const answerMethodRef = useRef<AnswerMethod | null>(null);
  const [answerMethod, setAnswerMethod] = useState<AnswerMethod | null>(null);
  const savePromiseRef = useRef<Promise<{
    ok: true;
    session: InterviewSession;
  } | {
    ok: false;
    error: string;
    session?: InterviewSession;
    conductWarning?: boolean;
  }> | null>(null);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [phase, setPhase] = useState<GuidedPhase>('BOOTING');
  const [caption, setCaption] = useState('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioDurationSec, setAudioDurationSec] = useState<number | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const answerRef = useRef('');
  const hasAudioRef = useRef(false);
  const audioDurationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    hasAudioRef.current = hasAudio;
  }, [hasAudio]);
  useEffect(() => {
    audioDurationRef.current = audioDurationSec;
  }, [audioDurationSec]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [thinkRemaining, setThinkRemaining] = useState(THINK_SECONDS);
  const [thinkProgress, setThinkProgress] = useState(1);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  useEffect(() => subscribeAiSpeech((s) => setAiSpeaking(s.speaking)), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPhase('BOOTING');
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
        // Resume mid-session → skip intro, go to current question.
        const answered = (next.liveQuestions || []).filter((q) => q.answer?.trim()).length;
        setPhase(answered > 0 ? 'QUESTION_DISPLAY' : 'INTRO_GREETING');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not start interview.');
          setPhase('ERROR');
          router.replace('/interviews/mock');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
      cancelGuidedSpeech();
      phaseRunId.current += 1;
    };
  }, [params.id, router]);

  const resetAnswerFields = useCallback(() => {
    setAnswer('');
    answerRef.current = '';
    setHasAudio(false);
    hasAudioRef.current = false;
    setAudioDurationSec(undefined);
    audioDurationRef.current = undefined;
    setIsRecording(false);
    setError('');
    setAnswerMethod(null);
    answerMethodRef.current = null;
  }, []);

  function chooseAnswerMethod(method: AnswerMethod) {
    answerMethodRef.current = method;
    setAnswerMethod(method);
    cancelGuidedSpeech();
    if (method === 'recording') {
      setPhase('RECORDING_COUNTDOWN');
    } else {
      setPhase('TYPING_ACTIVE');
    }
  }

  const goResult = useCallback(
    async (next: InterviewSession) => {
      setPhase('FINAL_PROCESSING');
      setCaption(buildAnalyzingLine());
      await speakGuided(buildAnalyzingLine()).catch(() => undefined);
      let reportSession = next;
      if (!reportSession.report) {
        try {
          reportSession = await endLiveInterview(params.id);
        } catch {
          // Result page polls.
        }
      }
      router.push(`/interviews/mock/${params.id}/result`);
    },
    [params.id, router],
  );

  const recordingArmedForIndex = useRef<number | null>(null);
  const armRunId = useRef(0);

  // Arm mic + speak once when entering RECORDING_ACTIVE (recorder is mounted).
  useEffect(() => {
    if (phase !== 'RECORDING_ACTIVE' || !session) return;
    if (recordingArmedForIndex.current === session.questionIndex) return;
    const runId = ++armRunId.current;
    const qIndex = session.questionIndex;

    async function arm() {
      recordingArmedForIndex.current = qIndex;
      const startLine = buildRecordStartLine();
      setCaption(startLine);
      await speakGuided(startLine);
      if (runId !== armRunId.current) return;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const ok = await recorderRef.current?.startImmediate();
      if (runId !== armRunId.current) return;
      if (!ok) {
        setError('Microphone access is needed to record your answer. You can still type your answer.');
      }
    }

    void arm();
    return () => {
      armRunId.current += 1;
    };
  }, [phase, session]);

  // Dedicated think-time countdown — keeps the bar decreasing smoothly.
  useEffect(() => {
    if (phase !== 'QUESTION_THINKING') return;
    setThinkRemaining(THINK_SECONDS);
    setThinkProgress(1);
    const startedAt = performance.now();
    const totalMs = THINK_SECONDS * 1000;
    let raf = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const left = Math.max(0, totalMs - (now - startedAt));
      setThinkProgress(left / totalMs);
      setThinkRemaining(Math.max(0, Math.ceil(left / 1000)));
      if (left > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        setThinkProgress(0);
        setThinkRemaining(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, session?.questionIndex]);

  // Phase orchestration
  useEffect(() => {
    if (!session) return;
    const activeSession = session;
    const runId = ++phaseRunId.current;
    const alive = () => runId === phaseRunId.current;

    async function runPhase() {
      const name = activeSession.candidateName;
      const qIndex = activeSession.questionIndex;
      const qText = activeSession.currentQuestion?.prompt || '';
      const qNum = qIndex + 1;
      const total = activeSession.totalQuestions;

      try {
        if (phase === 'INTRO_GREETING') {
          const line = buildGreetingLine(name);
          setCaption(line);
          await speakGuided(line);
          if (alive()) setPhase('INTRODUCTION');
          return;
        }

        if (phase === 'INTRODUCTION') {
          const line = buildIntroPlanLine(total);
          setCaption(line);
          await speakGuided(line);
          if (alive()) setPhase('INTRO_START');
          return;
        }

        if (phase === 'INTRO_START') {
          const line = buildIntroStartLine();
          setCaption(line);
          await speakGuided(line);
          if (alive()) setPhase('QUESTION_DISPLAY');
          return;
        }

        if (phase === 'QUESTION_DISPLAY') {
          setCaption(qText);
          setThinkRemaining(THINK_SECONDS);
          setThinkProgress(1);
          if (questionSpokenForIndex.current !== qIndex) {
            questionSpokenForIndex.current = qIndex;
            await speakGuided(qText);
          }
          if (alive()) setPhase('QUESTION_THINKING');
          return;
        }

        if (phase === 'QUESTION_THINKING') {
          const thinkLine = buildThinkSpokenLine();
          setCaption(buildThinkLine());
          if (thinkSpokenForIndex.current !== qIndex) {
            thinkSpokenForIndex.current = qIndex;
            await speakGuided(thinkLine);
          }
          // Timer runs in a dedicated effect so the progress bar stays smooth.
          return;
        }

        if (phase === 'RECORDING_COUNTDOWN') {
          cancelGuidedSpeech();
          setCaption('Get ready…');
          for (const n of [3, 2, 1] as const) {
            if (!alive()) return;
            setCountdownNum(n);
            await new Promise((r) => setTimeout(r, 900));
          }
          if (!alive()) return;
          setCountdownNum(null);
          setPhase('RECORDING_ACTIVE');
          return;
        }

        if (phase === 'QUESTION_COMPLETED') {
          const doneNum = completedQuestionNumber.current || qNum;
          const lines = buildQuestionCompletedLines(name, doneNum, total);
          setCaption(lines.primary);

          // Cherish on screen immediately; save finishes in parallel with voice.
          const savePromise = savePromiseRef.current;
          const speakPrimary = speakGuided(lines.primary);

          const saveResult = savePromise
            ? await savePromise
            : ({ ok: false, error: 'Could not save your answer. Please try again.' } as const);

          await speakPrimary;
          if (!alive()) return;

          if (!saveResult.ok) {
            if (saveResult.session) setSession(saveResult.session);
            setError(saveResult.error);
            setLoading(false);
            recordingArmedForIndex.current = null;
            setPhase(answerMethodRef.current === 'typing' ? 'TYPING_ACTIVE' : 'RECORDING_ACTIVE');
            return;
          }

          setSession(saveResult.session);
          resetAnswerFields();
          questionSpokenForIndex.current = null;
          thinkSpokenForIndex.current = null;
          setLoading(false);

          const finished =
            saveResult.session.status === 'COMPLETED' || Boolean(saveResult.session.conductTerminated);
          pendingNextPhase.current = finished ? 'FINAL_PROCESSING' : 'QUESTION_DISPLAY';

          setCaption(lines.secondary);
          await speakGuided(lines.secondary);
          if (!alive()) return;

          if (pendingNextPhase.current === 'FINAL_PROCESSING') {
            await goResult(saveResult.session);
            return;
          }
          recordingArmedForIndex.current = null;
          setPhase('QUESTION_DISPLAY');
          return;
        }
      } catch {
        if (!alive()) return;
        if (phase === 'INTRO_GREETING') setPhase('INTRODUCTION');
        else if (phase === 'INTRODUCTION') setPhase('INTRO_START');
        else if (phase === 'INTRO_START') setPhase('QUESTION_DISPLAY');
        else if (phase === 'QUESTION_DISPLAY') setPhase('QUESTION_THINKING');
        else if (phase === 'RECORDING_COUNTDOWN') setPhase('RECORDING_ACTIVE');
      }
    }

    void runPhase();
    return () => {
      phaseRunId.current += 1;
    };
  }, [phase, session, goResult]);

  async function submitAnswer() {
    if (!session?.currentQuestion || loading) return;
    if (isRecording) {
      recorderRef.current?.stop();
      // Allow MediaRecorder onstop to flush duration/transcript briefly.
      await new Promise((r) => setTimeout(r, 280));
    }

    const textAnswer = answerRef.current.trim();
    const audioReady = hasAudioRef.current || Boolean(audioDurationRef.current);
    if (textAnswer.length < 8 && !audioReady) {
      setError('Type your answer or record an audio response before continuing.');
      return;
    }

    cancelGuidedSpeech();
    setError('');
    setLoading(true);

    const justFinishedNumber = session.questionIndex + 1;
    completedQuestionNumber.current = justFinishedNumber;
    // Provisional — confirmed after save returns.
    pendingNextPhase.current =
      justFinishedNumber >= session.totalQuestions ? 'FINAL_PROCESSING' : 'QUESTION_DISPLAY';

    const answerMode: 'TEXT' | 'AUDIO' = textAnswer.length >= 8 ? 'TEXT' : 'AUDIO';
    const payloadText = textAnswer || '(audio answer recorded)';
    const duration = audioDurationRef.current;

    // Start save in background, show cherish UI immediately.
    savePromiseRef.current = (async () => {
      try {
        const next = await answerLiveInterview(params.id, payloadText, duration, answerMode);
        if (next.conductWarning && !next.conductTerminated) {
          return {
            ok: false as const,
            error: next.conductWarning,
            session: next,
            conductWarning: true,
          };
        }
        return { ok: true as const, session: next };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : 'Could not save your answer. Please try again.',
        };
      }
    })();

    setPhase('QUESTION_COMPLETED');
  }

  if (phase === 'BOOTING' || (!session && phase !== 'ERROR')) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-2">
          <InterviewBotFace size="lg" speaking />
          <p className="text-sm font-semibold text-slate-500">Loading interview…</p>
        </div>
      </CandidateAppShell>
    );
  }

  if (!session) {
    return (
      <CandidateAppShell activeTab="interviews">
        <p className="p-6 text-sm text-red-600">{error || 'Interview unavailable.'}</p>
      </CandidateAppShell>
    );
  }

  const questionNumber = session.questionIndex + 1;
  const questionText = session.currentQuestion?.prompt || '';
  const totalQuestions = session.totalQuestions;
  const steps = progressSteps(phase);
  const immersive =
    phase === 'INTRO_GREETING' ||
    phase === 'INTRODUCTION' ||
    phase === 'INTRO_START' ||
    phase === 'RECORDING_COUNTDOWN' ||
    phase === 'QUESTION_COMPLETED' ||
    phase === 'FINAL_PROCESSING';

  const showQuestionWorkspace =
    phase === 'QUESTION_DISPLAY' ||
    phase === 'QUESTION_THINKING' ||
    phase === 'RECORDING_ACTIVE' ||
    phase === 'TYPING_ACTIVE';

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <style dangerouslySetInnerHTML={{ __html: guidedStyles }} />
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24 sm:pb-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/interviews/mock"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a2e2c] sm:text-sm"
          >
            <span aria-hidden>←</span>
            <span>Setup</span>
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
            {GUIDED_PHASE_LABELS[phase]}
          </p>
        </div>

        {/* Pipeline indicator */}
        <nav aria-label="Interview progress" className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol className="flex w-max min-w-full items-center gap-1 sm:gap-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                  step.active
                    ? 'bg-[#0a2e2c] text-white'
                    : step.done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step.label}
              </li>
            ))}
          </ol>
        </nav>

        {/* Question counter */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">AI Mock Interview</p>
            <h1 className="text-sm font-extrabold text-[#0a2e2c] sm:text-lg">{session.jobRole}</h1>
            <p className="text-[11px] text-slate-600 sm:text-sm">
              {interviewTypeLabel(session.interviewType)} · Question {questionNumber} of {totalQuestions}
            </p>
          </div>
          <div className="flex items-center gap-1.5" aria-label={`Question ${questionNumber} of ${totalQuestions}`}>
            {Array.from({ length: totalQuestions }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${
                  i < questionNumber - 1
                    ? 'bg-emerald-500'
                    : i === questionNumber - 1
                      ? 'bg-[#0a2e2c] ring-2 ring-[#0a2e2c]/25'
                      : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Immersive light-green AI panels */}
        {immersive ? (
          <section
            className="cb-guided-panel relative overflow-hidden rounded-[1.5rem] border border-[rgba(10,46,44,0.1)] px-5 py-10 text-center sm:px-8 sm:py-14"
            aria-live="polite"
          >
            <div className="relative z-[1] mx-auto flex max-w-lg flex-col items-center gap-5">
              <InterviewBotFace size="xl" speaking={aiSpeaking || phase === 'FINAL_PROCESSING'} />
              {aiSpeaking ? <VoiceWave /> : null}

              {phase === 'RECORDING_COUNTDOWN' && countdownNum != null ? (
                <p
                  key={countdownNum}
                  className="cb-guided-count text-6xl font-black tabular-nums text-[#0a2e2c] sm:text-7xl"
                >
                  {countdownNum}
                </p>
              ) : null}

              {phase === 'QUESTION_COMPLETED' || phase === 'FINAL_PROCESSING' ? (
                <div className="cb-guided-check" aria-hidden>
                  ✓
                </div>
              ) : null}

              <p className="text-lg font-bold leading-snug text-[#0a2e2c] sm:text-xl">{caption}</p>

              {phase === 'FINAL_PROCESSING' ? (
                <div className="cb-guided-spinner" role="status" aria-label="Analyzing your interview" />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Question + think + record workspace */}
        {showQuestionWorkspace ? (
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(10,46,44,0.08)]">
            <div className="border-b border-slate-100 bg-[#f4faf9] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2e2c]/70">
                Question {questionNumber}
              </p>
              <blockquote className="mt-2 text-[15px] font-bold leading-snug text-slate-900 sm:text-lg">
                {questionText}
              </blockquote>
              {phase === 'QUESTION_DISPLAY' && aiSpeaking ? (
                <div className="mt-3 flex items-center gap-2">
                  <VoiceWave />
                  <span className="text-xs font-semibold text-slate-500">AI is reading the question…</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {phase === 'QUESTION_THINKING' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-[#f8faf9] p-5 text-center" role="timer">
                    <p className="text-sm font-bold text-[#0a2e2c]">Think Time</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{buildThinkLine()}</p>
                    <div className="mx-auto mt-4 h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#0a2e2c]"
                        style={{
                          width: `${Math.max(0, Math.min(100, thinkProgress * 100))}%`,
                          transition: 'none',
                        }}
                      />
                    </div>
                    <p className="mt-3 text-3xl font-black tabular-nums text-[#0a2e2c]">{thinkRemaining}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {thinkRemaining > 0 ? 'seconds remaining' : 'Choose how you want to answer'}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Choose way of answering
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => chooseAnswerMethod('recording')}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0a2e2c]">
                          <MicIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-extrabold text-[#0a2e2c]">With recording</span>
                          <span className="mt-1 block text-xs font-medium text-slate-500">
                            3–2–1 countdown, then speak your answer
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseAnswerMethod('typing')}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0a2e2c]">
                          <KeyboardIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-extrabold text-[#0a2e2c]">With typing</span>
                          <span className="mt-1 block text-xs font-medium text-slate-500">
                            Type your answer — mic available if you want
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {phase === 'RECORDING_ACTIVE' ? (
                <>
                  <div>
                    <label htmlFor="mock-answer" className="mb-1.5 block text-xs font-bold text-slate-800 sm:text-sm">
                      Your answer
                    </label>
                    <textarea
                      id="mock-answer"
                      value={answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        answerRef.current = e.target.value;
                      }}
                      onPaste={blockClipboardPaste}
                      onDrop={blockClipboardPaste}
                      autoComplete="off"
                      spellCheck
                      placeholder={
                        isRecording
                          ? 'Listening… speech appears here live'
                          : 'Speak clearly — your words appear here.'
                      }
                      rows={4}
                      disabled={loading}
                      className={`min-h-[100px] w-full resize-y rounded-xl border bg-[#fbfcfc] px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:bg-white focus:ring-2 disabled:opacity-60 ${
                        isRecording
                          ? 'border-red-200 ring-2 ring-red-100'
                          : 'border-slate-200 focus:ring-[#0a2e2c]/30'
                      }`}
                    />
                  </div>

                  <AudioAnswerRecorder
                    key={`recorder-q-${session.questionIndex}`}
                    ref={recorderRef}
                    disabled={loading}
                    hideIdleButton
                    hideInternalCountdown
                    onRecordingChange={setIsRecording}
                    onRecorded={({ durationSec, transcript }) => {
                      setHasAudio(true);
                      hasAudioRef.current = true;
                      setAudioDurationSec(durationSec);
                      audioDurationRef.current = durationSec;
                      if (transcript?.trim()) {
                        setAnswer(transcript.trim());
                        answerRef.current = transcript.trim();
                      }
                    }}
                    onClear={() => {
                      setHasAudio(false);
                      hasAudioRef.current = false;
                      setAudioDurationSec(undefined);
                      audioDurationRef.current = undefined;
                    }}
                    onLiveTranscript={(text) => {
                      setAnswer(text);
                      answerRef.current = text;
                    }}
                  />

                  {error ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600 sm:text-sm">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    loading={loading}
                    loadingLabel="Saving…"
                    onClick={() => void submitAnswer()}
                    className="w-full !rounded-full"
                  >
                    {(() => {
                      const isLast = questionNumber >= totalQuestions;
                      if (isRecording) return isLast ? 'Stop & Finish' : 'Stop & Next';
                      return isLast ? 'Finish' : 'Next';
                    })()}
                  </Button>
                </>
              ) : null}

              {phase === 'TYPING_ACTIVE' ? (
                <>
                  {/* Big reflection box */}
                  <div
                    className="min-h-[140px] rounded-2xl border border-[#d8eef0] bg-[#f4faf9] px-4 py-4 sm:min-h-[180px]"
                    aria-live="polite"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2e2c]/70">
                      Your answer
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
                      {answer.trim() ? answer : (
                        <span className="font-medium text-slate-400">Your answer will appear here as you type…</span>
                      )}
                    </p>
                  </div>

                  {/* Type box + mic on the right */}
                  <div className="flex items-stretch gap-2">
                    <textarea
                      id="mock-answer-type"
                      value={answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        answerRef.current = e.target.value;
                      }}
                      onPaste={blockClipboardPaste}
                      onDrop={blockClipboardPaste}
                      autoComplete="off"
                      spellCheck
                      placeholder="Type your answer here… (paste is disabled)"
                      rows={3}
                      disabled={loading || isRecording}
                      className="min-h-[88px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:ring-2 focus:ring-[#0a2e2c]/30 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      title={isRecording ? 'Stop recording' : 'Record with microphone'}
                      aria-label={isRecording ? 'Stop recording' : 'Record with microphone'}
                      disabled={loading}
                      onClick={() => {
                        if (isRecording) {
                          recorderRef.current?.stop();
                          return;
                        }
                        void recorderRef.current?.startImmediate().then((ok) => {
                          if (!ok) {
                            setError('Microphone access is needed to record. You can keep typing.');
                          }
                        });
                      }}
                      className={`inline-flex w-14 shrink-0 items-center justify-center rounded-xl border transition sm:w-16 ${
                        isRecording
                          ? 'border-red-300 bg-red-50 text-red-600'
                          : 'border-slate-200 bg-white text-[#0a2e2c] hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isRecording ? <StopIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Mic-backed recorder (wave shows while recording / after save) */}
                  <div className={isRecording || hasAudio ? 'block' : 'sr-only'}>
                    <AudioAnswerRecorder
                      key={`recorder-type-q-${session.questionIndex}`}
                      ref={recorderRef}
                      disabled={loading}
                      hideIdleButton
                      hideInternalCountdown
                      onRecordingChange={setIsRecording}
                      onRecorded={({ durationSec, transcript }) => {
                        setHasAudio(true);
                        hasAudioRef.current = true;
                        setAudioDurationSec(durationSec);
                        audioDurationRef.current = durationSec;
                        if (transcript?.trim()) {
                          setAnswer(transcript.trim());
                          answerRef.current = transcript.trim();
                        }
                      }}
                      onClear={() => {
                        setHasAudio(false);
                        hasAudioRef.current = false;
                        setAudioDurationSec(undefined);
                        audioDurationRef.current = undefined;
                      }}
                      onLiveTranscript={(text) => {
                        if (text.trim()) {
                          setAnswer(text);
                          answerRef.current = text;
                        }
                      }}
                    />
                  </div>

                  {error ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600 sm:text-sm">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    loading={loading}
                    loadingLabel="Saving…"
                    onClick={() => void submitAnswer()}
                    className="w-full !rounded-full"
                  >
                    {(() => {
                      const isLast = questionNumber >= totalQuestions;
                      if (isRecording) return isLast ? 'Stop & Finish' : 'Stop & Next';
                      return isLast ? 'Finish' : 'Next';
                    })()}
                  </Button>
                </>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    </CandidateAppShell>
  );
}

function VoiceWave() {
  return (
    <div className="cb-voice-wave" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

function MicIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 1.75a3.25 3.25 0 0 0-3.25 3.25v6a3.25 3.25 0 1 0 6.5 0v-6A3.25 3.25 0 0 0 12 1.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 11.25a6.25 6.25 0 0 0 12.5 0M12 17.5v4.75M8.5 22.25h7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeyboardIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.75"
        y="6.75"
        width="18.5"
        height="10.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.25h.01M10 13.25h4M15.5 13.25h.01M17 13.25h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

const guidedStyles = `
  .cb-guided-panel {
    background:
      radial-gradient(90% 80% at 10% 0%, rgba(20, 184, 166, 0.12) 0%, transparent 50%),
      radial-gradient(70% 60% at 100% 100%, rgba(234, 179, 8, 0.1) 0%, transparent 45%),
      linear-gradient(160deg, #e8f5f2 0%, #f4faf9 45%, #eef7f4 100%);
    animation: cb-guided-fade 0.55s ease;
  }
  .cb-guided-count {
    animation: cb-guided-pop 0.55s ease;
  }
  .cb-guided-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: #0a2e2c;
    color: #fff;
    font-size: 1.6rem;
    font-weight: 800;
    animation: cb-guided-pop 0.5s ease;
  }
  .cb-guided-spinner {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 3px solid rgba(10, 46, 44, 0.15);
    border-top-color: #0a2e2c;
    animation: cb-guided-spin 0.85s linear infinite;
  }
  .cb-voice-wave {
    display: inline-flex;
    align-items: flex-end;
    gap: 4px;
    height: 22px;
  }
  .cb-voice-wave span {
    width: 4px;
    height: 8px;
    border-radius: 999px;
    background: #0a2e2c;
    animation: cb-voice-bar 0.9s ease-in-out infinite;
  }
  @keyframes cb-guided-fade {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes cb-guided-pop {
    0% { opacity: 0; transform: scale(0.6); }
    70% { transform: scale(1.08); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes cb-guided-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes cb-voice-bar {
    0%, 100% { height: 6px; opacity: 0.55; }
    50% { height: 20px; opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cb-guided-panel, .cb-guided-count, .cb-guided-check, .cb-voice-wave span, .cb-guided-spinner {
      animation: none;
    }
  }
`;
