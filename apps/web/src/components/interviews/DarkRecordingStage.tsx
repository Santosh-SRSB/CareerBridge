'use client';

import { useEffect, useState, type MutableRefObject } from 'react';
import { AudioWaveformVisualizer } from '@/components/interviews/AudioWaveformVisualizer';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';

type IntroStep = 'three' | 'two' | 'speak' | 'done';
type BotPhase = 'intro' | 'handsOff';

const MOTIVATION_LINES = [
  'Go ahead',
  'Stay focused',
  'You can do it',
  'Take a breath',
  'Speak with confidence',
  'You have got this',
  'Believe in yourself',
  'Keep going',
  'Clear and calm',
  'Own this moment',
];

const INTRO_BOT_MS = 3200;

function formatClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pickMotivation(exclude?: string) {
  const pool = exclude ? MOTIVATION_LINES.filter((line) => line !== exclude) : MOTIVATION_LINES;
  return pool[Math.floor(Math.random() * pool.length)] || MOTIVATION_LINES[0];
}

export function DarkRecordingStage({
  mode,
  questionNumber,
  questionText,
  transcript,
  amplitudeRef,
  elapsedSec,
  isRecording,
  loading,
  error,
  isLast,
  onIntroComplete,
  onStopAndSubmit,
}: {
  mode: 'intro' | 'recording';
  questionNumber: number;
  questionText: string;
  transcript: string;
  amplitudeRef: MutableRefObject<number>;
  elapsedSec: number;
  isRecording: boolean;
  loading: boolean;
  error?: string;
  isLast: boolean;
  onIntroComplete: () => void;
  onStopAndSubmit: () => void;
}) {
  const [introStep, setIntroStep] = useState<IntroStep>('three');
  const [botPhase, setBotPhase] = useState<BotPhase>('intro');
  const [motivation, setMotivation] = useState(() => pickMotivation());

  useEffect(() => {
    if (mode !== 'intro') {
      setIntroStep('done');
      return;
    }
    setIntroStep('three');
    const t1 = window.setTimeout(() => setIntroStep('two'), 900);
    const t2 = window.setTimeout(() => setIntroStep('speak'), 1800);
    const t3 = window.setTimeout(() => {
      setIntroStep('done');
      onIntroComplete();
    }, 2800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [mode, onIntroComplete]);

  useEffect(() => {
    setBotPhase('intro');
    if (mode !== 'recording') return;
    const t = window.setTimeout(() => setBotPhase('handsOff'), INTRO_BOT_MS);
    return () => window.clearTimeout(t);
  }, [mode, questionNumber]);

  useEffect(() => {
    if (botPhase !== 'handsOff') return;
    setMotivation(pickMotivation());
    const id = window.setInterval(() => {
      setMotivation((prev) => pickMotivation(prev));
    }, 2000);
    return () => window.clearInterval(id);
  }, [botPhase]);

  const showIntro = mode === 'intro' && introStep !== 'done';
  const showHandsOff = botPhase === 'handsOff';

  return (
    <div className="cb-dark-rec fixed inset-0 z-[80] flex flex-col bg-[#05070c] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 20% 30%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(ellipse 55% 45% at 85% 20%, rgba(168,85,247,0.16), transparent 50%), radial-gradient(ellipse 50% 40% at 70% 80%, rgba(80,100,255,0.08), transparent 55%)',
        }}
        aria-hidden
      />

      {showIntro ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg text-center" role="status" aria-live="assertive">
            {introStep === 'three' ? (
              <div className="cb-dark-rec__cards flex items-center justify-center gap-3 sm:gap-4">
                {[3, 2, 1].map((n, i) => (
                  <div
                    key={n}
                    className="cb-dark-rec__card"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="text-4xl font-black tabular-nums sm:text-5xl">{n}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {introStep === 'two' ? (
              <div className="cb-dark-rec__cards cb-dark-rec__cards--swap flex items-center justify-center gap-4 sm:gap-6">
                <div className="cb-dark-rec__card cb-dark-rec__card--a">
                  <span className="text-4xl font-black tabular-nums sm:text-5xl">2</span>
                </div>
                <div className="cb-dark-rec__card cb-dark-rec__card--b">
                  <span className="text-4xl font-black tabular-nums sm:text-5xl">1</span>
                </div>
              </div>
            ) : null}

            {introStep === 'speak' ? (
              <div className="cb-dark-rec__speak flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-cyan-400 shadow-[0_0_40px_rgba(99,102,241,0.55)] sm:h-24 sm:w-24">
                  <MicGlyph className="h-9 w-9 text-white sm:h-11 sm:w-11" />
                </div>
                <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">Start speaking</p>
                <p className="text-sm font-medium text-white/55">Setting up your recording…</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col transition-opacity duration-500 ${
          showIntro ? 'opacity-40' : 'opacity-100'
        }`}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isRecording ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              ) : null}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isRecording ? 'bg-red-500' : 'bg-white/30'
                }`}
              />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
              {isRecording ? 'Recording' : 'Get ready'}
            </span>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums text-white/80">
            {formatClock(elapsedSec)}
          </span>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 sm:gap-6 sm:px-6 sm:pb-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex min-h-0 flex-col gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
                Question {questionNumber}
              </p>
              <h2 className="mt-2 text-lg font-bold leading-snug text-white sm:text-xl lg:text-2xl">
                {questionText}
              </h2>
            </div>
            <div className="mt-auto min-h-[140px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black sm:min-h-[180px]">
              <AudioWaveformVisualizer
                amplitudeRef={amplitudeRef}
                active={isRecording}
                className="h-full min-h-[140px] w-full sm:min-h-[180px]"
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-4">
            <div className="relative flex min-h-[160px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 sm:min-h-[180px] sm:px-4">
              {!showHandsOff ? (
                <div className="relative w-full max-w-[280px] overflow-hidden rounded-2xl bg-black/50 sm:max-w-[320px]">
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <video
                      key={`intro-bot-${questionNumber}`}
                      src="/ai-robo.mp4"
                      autoPlay
                      muted
                      playsInline
                      className="pointer-events-none h-[118%] w-full object-cover object-top"
                      aria-label="AI interviewer"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative flex w-full max-w-[320px] items-center justify-center gap-2 sm:max-w-[360px]">
                  <div
                    key={motivation}
                    className="cb-dark-rec__cloud relative z-10 max-w-[48%] shrink-0"
                    aria-live="polite"
                  >
                    <div className="relative rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-[#1a2744]/95 to-[#0d1528]/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(59,130,246,0.35)] backdrop-blur-md sm:px-3.5 sm:py-3">
                      <p className="text-center text-[12px] font-bold leading-snug text-cyan-100 sm:text-sm">
                        {motivation}
                      </p>
                      <span
                        className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-cyan-300/30 bg-[#132038]"
                        aria-hidden
                      />
                    </div>
                  </div>
                  <InterviewBotFace
                    size="xl"
                    speaking={isRecording}
                    className="shrink-0 drop-shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                  />
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Your words
              </p>
              <div className="mt-2 min-h-[100px] flex-1 overflow-y-auto text-sm leading-relaxed text-white/90 sm:text-base">
                {transcript.trim() ? (
                  <p className="whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-white/35">
                    {isRecording
                      ? 'What you say will appear here live…'
                      : 'Transcript appears after you start speaking.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="relative z-10 space-y-2 border-t border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
          {error ? (
            <p className="text-center text-xs font-semibold text-red-300 sm:text-sm">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={loading || mode === 'intro'}
            onClick={onStopAndSubmit}
            className="w-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition enabled:hover:brightness-110 disabled:opacity-50"
          >
            {loading
              ? 'Saving…'
              : isRecording
                ? isLast
                  ? 'Stop & Finish'
                  : 'Stop & Next'
                : isLast
                  ? 'Finish'
                  : 'Next'}
          </button>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: darkRecStyles }} />
    </div>
  );
}

function MicGlyph({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 11a7 7 0 01-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const darkRecStyles = `
  .cb-dark-rec__card {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 120px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    animation: cb-dark-card-in 0.45s ease both;
  }
  @media (min-width: 640px) {
    .cb-dark-rec__card {
      width: 108px;
      height: 148px;
    }
  }
  .cb-dark-rec__cards--swap .cb-dark-rec__card--a {
    animation: cb-dark-swap-a 0.7s ease both;
  }
  .cb-dark-rec__cards--swap .cb-dark-rec__card--b {
    animation: cb-dark-swap-b 0.7s ease both;
  }
  .cb-dark-rec__speak {
    animation: cb-dark-card-in 0.4s ease both;
  }
  .cb-dark-rec__cloud {
    animation: cb-dark-cloud-in 0.45s ease both;
  }
  @keyframes cb-dark-card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.92); }
    to { opacity: 1; transform: none; }
  }
  @keyframes cb-dark-swap-a {
    0% { transform: translateX(0) rotate(0deg); }
    45% { transform: translateX(36px) rotate(8deg) scale(1.05); z-index: 2; }
    100% { transform: translateX(0) rotate(-2deg); }
  }
  @keyframes cb-dark-swap-b {
    0% { transform: translateX(0) rotate(0deg); }
    45% { transform: translateX(-36px) rotate(-8deg) scale(0.96); }
    100% { transform: translateX(0) rotate(2deg); }
  }
  @keyframes cb-dark-cloud-in {
    from { opacity: 0; transform: translate(-6px, 4px) scale(0.94); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cb-dark-rec__card,
    .cb-dark-rec__cards--swap .cb-dark-rec__card--a,
    .cb-dark-rec__cards--swap .cb-dark-rec__card--b,
    .cb-dark-rec__speak,
    .cb-dark-rec__cloud {
      animation: none;
    }
  }
`;
