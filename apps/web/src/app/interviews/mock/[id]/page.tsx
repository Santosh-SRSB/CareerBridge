'use client';

import { userFacingError } from '@/lib/client-errors';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AI_INTERVIEW_QUESTION_FALLBACK_MESSAGE, type InterviewSession } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { DarkRecordingStage } from '@/components/interviews/DarkRecordingStage';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import {
  AudioAnswerRecorder,
  type AudioAnswerRecorderHandle,
} from '@/components/marketplace/AudioAnswerRecorder';
import {
  buildAnalyzingLine,
  buildGreetingLine,
  buildIntroPlanLine,
  buildIntroStartLine,
  buildQuestionCompletedLines,
  buildQuestionSkippedLines,
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
import {
  answerLiveInterview,
  endLiveInterview,
  getInterview,
  skipLiveInterviewQuestion,
  startLiveInterview,
} from '@/lib/api';
import { subscribeAiSpeech } from '@/features/interview/ai-speech';
import '../../candidate-interviews.css';
import './mock-session.css';

const ANSWER_MAX = 1000;
const ANSWER_MIN = 20;
const RECORD_MAX_SEC = 120;
const DEFAULT_TIP = 'Use a specific example from your experience.';

function interviewTypeLabel(type: string) {
  if (type === 'BEHAVIOURAL' || type === 'GENERIC') return 'Generic';
  if (type === 'ROLE' || type === 'ROLE_BASED') return 'Role Specific';
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
  const skippedRef = useRef(false);
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
  const [recordElapsedSec, setRecordElapsedSec] = useState(0);
  const thinkAutoStartedRef = useRef<number | null>(null);
  const amplitudeRef = useRef(0);

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
          setError(userFacingError(err, 'start interview'));
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
    amplitudeRef.current = 0;
    setRecordElapsedSec(0);
  }, []);

  function chooseAnswerMethod(method: AnswerMethod) {
    answerMethodRef.current = method;
    setAnswerMethod(method);
    cancelGuidedSpeech();
    if (method === 'recording') {
      amplitudeRef.current = 0;
      setRecordElapsedSec(0);
      setPhase('RECORDING_COUNTDOWN');
    } else {
      setPhase('TYPING_ACTIVE');
    }
  }

  const finishRecordingIntro = useCallback(() => {
    setPhase('RECORDING_ACTIVE');
  }, []);

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

  // Arm mic once when entering RECORDING_ACTIVE (dark stage + hidden recorder mounted).
  useEffect(() => {
    if (phase !== 'RECORDING_ACTIVE' || !session) return;
    if (recordingArmedForIndex.current === session.questionIndex) return;
    const runId = ++armRunId.current;
    const qIndex = session.questionIndex;

    async function arm() {
      recordingArmedForIndex.current = qIndex;
      setCaption(buildRecordStartLine());
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

  // Warm mic permission during the dark intro card animation.
  useEffect(() => {
    if (phase !== 'RECORDING_COUNTDOWN') return;
    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Keep tracks briefly warm, then release — startImmediate will re-acquire.
        window.setTimeout(() => {
          stream.getTracks().forEach((t) => t.stop());
        }, 2600);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [phase, session?.questionIndex]);

  // After think time ends, default into typing unless they already chose recording.
  useEffect(() => {
    if (phase !== 'QUESTION_THINKING') return;
    if (thinkRemaining > 0) return;
    const qIndex = session?.questionIndex ?? -1;
    if (thinkAutoStartedRef.current === qIndex) return;
    if (answerMethodRef.current) return;
    thinkAutoStartedRef.current = qIndex;
    const t = window.setTimeout(() => {
      if (answerMethodRef.current) return;
      chooseAnswerMethod('typing');
    }, 350);
    return () => window.clearTimeout(t);
  }, [phase, thinkRemaining, session?.questionIndex]);

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
          // DarkRecordingStage drives the 3→2→speak card intro, then advances.
          return;
        }

        if (phase === 'QUESTION_COMPLETED') {
          const doneNum = completedQuestionNumber.current || qNum;
          const lines = skippedRef.current
            ? buildQuestionSkippedLines(doneNum, total)
            : buildQuestionCompletedLines(name, doneNum, total);
          // Caption + primary TTS already kicked off in submitAnswer — keep copy visible.
          setCaption(lines.primary);

          const savePromise = savePromiseRef.current;
          const saveResult = savePromise
            ? await savePromise
            : ({ ok: false, error: 'Could not save your answer. Please try again.' } as const);

          if (!alive()) return;

          skippedRef.current = false;
          if (!saveResult.ok) {
            if ('session' in saveResult && saveResult.session) setSession(saveResult.session);
            setError(saveResult.error);
            setLoading(false);
            recordingArmedForIndex.current = null;
            setPhase(answerMethodRef.current === 'recording' ? 'RECORDING_ACTIVE' : 'TYPING_ACTIVE');
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
          thinkAutoStartedRef.current = null;
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

  useEffect(() => {
    if (isRecording && recordElapsedSec >= RECORD_MAX_SEC) void submitAnswer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recordElapsedSec]);

  async function submitAnswer() {
    if (!session?.currentQuestion || loading) return;
    if (isRecording) {
      recorderRef.current?.stop();
      // Allow MediaRecorder onstop to flush duration/transcript briefly.
      await new Promise((r) => setTimeout(r, 280));
    }

    const textAnswer = answerRef.current.trim();
    const audioReady = hasAudioRef.current || Boolean(audioDurationRef.current);
    if (textAnswer.length < ANSWER_MIN && !audioReady) {
      setError(`Type your answer or record an audio response before continuing (minimum ${ANSWER_MIN} characters).`);
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

    // Celebrate immediately (no silent wait after leaving dark mode).
    const celebrate = buildQuestionCompletedLines(
      session.candidateName,
      justFinishedNumber,
      session.totalQuestions,
    );
    cancelGuidedSpeech();
    setCaption(celebrate.primary);
    void speakGuided(celebrate.primary).catch(() => undefined);

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

  function skipQuestion() {
    if (!session?.currentQuestion || loading) return;
    if (isRecording) recorderRef.current?.stop();
    cancelGuidedSpeech();
    setError('');
    setLoading(true);
    const skippedNumber = session.questionIndex + 1;
    const questionIndex = session.questionIndex;
    completedQuestionNumber.current = skippedNumber;
    pendingNextPhase.current = skippedNumber >= session.totalQuestions ? 'FINAL_PROCESSING' : 'QUESTION_DISPLAY';
    skippedRef.current = true;
    const lines = buildQuestionSkippedLines(skippedNumber, session.totalQuestions);
    setCaption(lines.primary);
    void speakGuided(lines.primary).catch(() => undefined);
    savePromiseRef.current = (async () => {
      try {
        return { ok: true as const, session: await skipLiveInterviewQuestion(params.id, questionIndex) };
      } catch (err) {
        return { ok: false as const, error: userFacingError(err, 'skip this question') };
      }
    })();
    setPhase('QUESTION_COMPLETED');
  }

  if (phase === 'BOOTING' || (!session && phase !== 'ERROR')) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="iv ms-boot" role="status">
          <InterviewBotFace size="lg" speaking />
          <p className="iv-meta">Loading interview…</p>
        </div>
      </CandidateAppShell>
    );
  }

  if (!session) {
    return (
      <CandidateAppShell activeTab="interviews">
        <div className="iv">
          <p className="iv-err" role="alert">
            {error || 'Interview unavailable.'}
          </p>
        </div>
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
    phase === 'QUESTION_COMPLETED' ||
    phase === 'FINAL_PROCESSING';

  const darkRecording =
    phase === 'RECORDING_COUNTDOWN' || phase === 'RECORDING_ACTIVE';

  const showQuestionWorkspace =
    phase === 'QUESTION_DISPLAY' ||
    phase === 'QUESTION_THINKING' ||
    phase === 'TYPING_ACTIVE';

  const thinkPct = Math.max(0, Math.min(100, thinkProgress * 100));
  const thinkRing = 2 * Math.PI * 23;
  const thinkColor =
    thinkProgress > 0.6 ? '#16a34a' : thinkProgress > 0.3 ? '#f59e0b' : '#dc2626';

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="iv ms">
        <div className="ms-top">
          <Link href="/interviews/mock" className="iv-back">
            <span aria-hidden>←</span>
            <span>Setup</span>
          </Link>
          <p className="ms-phase">{GUIDED_PHASE_LABELS[phase]}</p>
        </div>

        {/* Pipeline indicator */}
        <nav aria-label="Interview progress" className="ms-steps-wrap">
          <ol className="ms-steps">
            {steps.map((step) => (
              <li
                key={step.id}
                aria-current={step.active ? 'step' : undefined}
                className={`ms-step${step.active ? ' ms-step--active' : step.done ? ' ms-step--done' : ''}`}
              >
                {step.label}
              </li>
            ))}
          </ol>
        </nav>

        {/* Question counter */}
        <div className="ms-card ms-counter">
          <div className="min-w-0">
            <p className="ms-eyebrow">AI Mock Interview</p>
            <h1 className="ms-role">{session.jobRole}</h1>
            <p className="iv-meta">
              {interviewTypeLabel(session.interviewType)} · Question {questionNumber} of {totalQuestions}
            </p>
          </div>
          <div className="ms-dots" role="img" aria-label={`Question ${questionNumber} of ${totalQuestions}`}>
            {Array.from({ length: totalQuestions }, (_, i) => (
              <span
                key={i}
                className={`ms-dot${
                  i < questionNumber - 1 ? ' ms-dot--done' : i === questionNumber - 1 ? ' ms-dot--now' : ''
                }`}
              />
            ))}
          </div>
        </div>

        {/* Immersive AI panels */}
        {immersive ? (
          <section className="ms-stage" aria-live="polite">
            <div className="ms-stage-in">
              <InterviewBotFace size="xl" speaking={aiSpeaking || phase === 'FINAL_PROCESSING'} />
              {aiSpeaking ? <VoiceWave /> : null}

              {phase === 'QUESTION_COMPLETED' || phase === 'FINAL_PROCESSING' ? (
                <div className="ms-check" aria-hidden>
                  ✓
                </div>
              ) : null}

              <p className="ms-caption">{caption}</p>

              {phase === 'FINAL_PROCESSING' ? (
                <div className="ms-spinner" role="status" aria-label="Analyzing your interview" />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Question + think + record workspace */}
        {showQuestionWorkspace ? (
          <article className="ms-card ms-work">
            <div className="ms-q-head">
              <InterviewBotFace
                size="md"
                speaking={
                  phase === 'QUESTION_THINKING' ||
                  (phase === 'QUESTION_DISPLAY' && aiSpeaking)
                }
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="ms-eyebrow">Question {questionNumber}</p>
                <blockquote className="ms-question">{questionText}</blockquote>
                {session.currentQuestion?.aiFallback ? (
                  <p role="status" data-testid="ai-unavailable" className="ms-fallback">
                    {AI_INTERVIEW_QUESTION_FALLBACK_MESSAGE}
                  </p>
                ) : null}
                <p className="ms-tip" data-testid="question-tip">
                  <span aria-hidden>💡 </span>Tip:{' '}
                  {(!session.currentQuestion?.aiFallback && session.currentQuestion?.snippet?.trim()) || DEFAULT_TIP}
                </p>
                {phase === 'QUESTION_DISPLAY' && aiSpeaking ? (
                  <div className="ms-reading">
                    <VoiceWave />
                    <span>AI is reading the question…</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ms-body">
              {phase === 'QUESTION_THINKING' ? (
                <div className="ms-think">
                  <img src="/think-brain.png" alt="" aria-hidden className="ms-brain" />

                  <div
                    className="ms-timer"
                    role="timer"
                    aria-label={`${thinkRemaining} seconds of think time remaining`}
                  >
                    <div className="ms-ring">
                      <svg viewBox="0 0 56 56" aria-hidden>
                        <circle cx="28" cy="28" r="23" fill="none" stroke="#e3ebff" strokeWidth="6" />
                        <circle
                          cx="28"
                          cy="28"
                          r="23"
                          fill="none"
                          stroke={thinkColor}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={thinkRing}
                          strokeDashoffset={thinkRing * (1 - thinkPct / 100)}
                          style={{ transition: 'stroke 0.3s ease' }}
                        />
                      </svg>
                      <div className="ms-ring-n">{thinkRemaining}</div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="ms-timer-t">
                        <span>
                          {thinkRemaining > 0
                            ? 'Thinking time — get ready'
                            : 'Choose how you want to answer'}
                        </span>
                        {thinkRemaining > 0 ? (
                          <span className="ms-think-dots" aria-hidden>
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : null}
                      </div>
                      <div className="ms-bar">
                        <div
                          style={{
                            width: `${thinkPct}%`,
                            backgroundColor: thinkColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="iv-sec-t ms-method-t">Choose way of answering</p>
                    <div className="ms-methods">
                      <button
                        type="button"
                        onClick={() => chooseAnswerMethod('typing')}
                        className="ms-method ms-method--default"
                      >
                        <span className="ms-method-badge">Default</span>
                        <span className="ms-method-ic">
                          <KeyboardIcon className="h-4 w-4" />
                        </span>
                        <span className="ms-method-l">Typing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseAnswerMethod('recording')}
                        className="ms-method"
                      >
                        <span className="ms-method-ic">
                          <MicIcon className="h-4 w-4" />
                        </span>
                        <span className="ms-method-l">Recording</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={skipQuestion}
                      disabled={loading}
                      className="iv-btn iv-btn--ghost iv-btn--full ms-skip"
                    >
                      Skip Question
                    </button>
                  </div>
                </div>
              ) : null}

              {phase === 'TYPING_ACTIVE' ? (
                <>
                  {/* Big reflection box */}
                  <div className="ms-preview" aria-live="polite">
                    <p className="ms-eyebrow">Your answer</p>
                    <p className="ms-preview-t">
                      {answer.trim() ? answer : (
                        <span className="ms-preview-ph">Your answer will appear here as you type…</span>
                      )}
                    </p>
                  </div>

                  {/* Type box + mic on the right */}
                  <label htmlFor="mock-answer-type" className="sr-only">
                    Your answer
                  </label>
                  <div className="ms-type">
                    <textarea
                      id="mock-answer-type"
                      value={answer}
                      maxLength={ANSWER_MAX}
                      aria-describedby="mock-answer-count"
                      onChange={(e) => {
                        const next = e.target.value.slice(0, ANSWER_MAX);
                        setAnswer(next);
                        answerRef.current = next;
                      }}
                      onPaste={blockClipboardPaste}
                      onDrop={blockClipboardPaste}
                      autoComplete="off"
                      spellCheck
                      placeholder="Type your answer here… (paste is disabled)"
                      rows={3}
                      disabled={loading}
                      className="ms-textarea"
                    />
                    <button
                      type="button"
                      title="Switch to recording"
                      aria-label="Switch to recording"
                      disabled={loading}
                      onClick={() => chooseAnswerMethod('recording')}
                      className="ms-mic"
                    >
                      <MicIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <p
                    id="mock-answer-count"
                    className={`ms-count${answer.length >= ANSWER_MAX ? ' ms-count--max' : ''}`}
                  >
                    Characters: {answer.length} / {ANSWER_MAX}
                  </p>

                  {error ? (
                    <p className="ms-error" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={loading}
                    aria-busy={loading || undefined}
                    onClick={() => void submitAnswer()}
                    className="iv-btn iv-btn--full"
                  >
                    {loading ? (
                      <>
                        <span aria-hidden data-testid="button-spinner" className="iv-spin" />
                        Saving…
                      </>
                    ) : questionNumber >= totalQuestions ? (
                      'Finish'
                    ) : (
                      'Next'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={skipQuestion}
                    disabled={loading}
                    className="iv-btn iv-btn--ghost iv-btn--full"
                  >
                    Skip Question
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>

      {darkRecording ? (
        <>
          <DarkRecordingStage
            mode={phase === 'RECORDING_COUNTDOWN' ? 'intro' : 'recording'}
            questionNumber={questionNumber}
            questionText={questionText}
            transcript={answer}
            amplitudeRef={amplitudeRef}
            elapsedSec={recordElapsedSec}
            maxSec={RECORD_MAX_SEC}
            isRecording={isRecording}
            loading={loading}
            error={error || undefined}
            isLast={questionNumber >= totalQuestions}
            onIntroComplete={finishRecordingIntro}
            onStopAndSubmit={() => void submitAnswer()}
            onSwitchToTyping={() => {
              recordingArmedForIndex.current = null;
              setError('');
              chooseAnswerMethod('typing');
            }}
          />
          <AudioAnswerRecorder
            key={`recorder-q-${session.questionIndex}`}
            ref={recorderRef}
            disabled={loading}
            hideUi
            hideIdleButton
            hideInternalCountdown
            onRecordingChange={setIsRecording}
            onAmplitudeChange={(amp) => {
              amplitudeRef.current = amp;
            }}
            onElapsedChange={setRecordElapsedSec}
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
        </>
      ) : null}
    </CandidateAppShell>
  );
}

function VoiceWave() {
  return (
    <div className="ms-wave" aria-hidden>
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
