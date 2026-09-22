'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';

const BAR_COUNT = 28;
const SILENT_FLOOR = 10;
const VOICE_THRESHOLD = 18;

type CountdownPhase = number | 'speak';

export type AudioAnswerRecorderHandle = {
  /** Acquire mic and start recording immediately (no internal 1-2-3). */
  startImmediate: () => Promise<boolean>;
  stop: () => void;
  isRecording: () => boolean;
};

function speechCtor() {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function pickMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
  return types.find((type) => !type || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))) || '';
}

function buildIdleLevels() {
  return Array.from({ length: BAR_COUNT }, () => SILENT_FLOOR);
}

function formatClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AudioAnswerRecorder = forwardRef<
  AudioAnswerRecorderHandle,
  {
    disabled?: boolean;
    onRecorded?: (payload: { durationSec: number; transcript?: string }) => void;
    onClear?: () => void;
    /** Fires while speaking so the parent can show live captions in a text box. */
    onLiveTranscript?: (text: string) => void;
    onRecordingChange?: (recording: boolean) => void;
    /** Hide the manual "Record Answer" button (guided flow starts recording externally). */
    hideIdleButton?: boolean;
    /** Hide the built-in 1-2-3 countdown UI (parent owns the immersive countdown). */
    hideInternalCountdown?: boolean;
  }
>(function AudioAnswerRecorder(
  {
    disabled = false,
    onRecorded,
    onClear,
    onLiveTranscript,
    onRecordingChange,
    hideIdleButton = false,
    hideInternalCountdown = false,
  },
  ref,
) {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<CountdownPhase | null>(null);
  const [recordedSec, setRecordedSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState<number[]>(buildIdleLevels);
  const [error, setError] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const levelsRef = useRef<number[]>(buildIdleLevels());
  const [frozenLevels, setFrozenLevels] = useState<number[] | null>(null);
  const transcriptRef = useRef('');
  const committedRef = useRef('');
  const speechRef = useRef<SpeechRecognition | null>(null);
  const onLiveTranscriptRef = useRef(onLiveTranscript);
  const onRecordingChangeRef = useRef(onRecordingChange);
  const recordingRef = useRef(false);

  useEffect(() => {
    onLiveTranscriptRef.current = onLiveTranscript;
  }, [onLiveTranscript]);

  useEffect(() => {
    onRecordingChangeRef.current = onRecordingChange;
  }, [onRecordingChange]);

  function publishTranscript(text: string) {
    transcriptRef.current = text;
    onLiveTranscriptRef.current?.(text);
  }

  function stopSpeech() {
    speechRef.current?.stop();
    speechRef.current = null;
  }

  function startSpeech() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    transcriptRef.current = '';
    committedRef.current = '';
    publishTranscript('');
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) {
          committedRef.current = `${committedRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      publishTranscript(`${committedRef.current} ${interim}`.trim());
    };
    rec.onerror = () => undefined;
    try {
      rec.start();
      speechRef.current = rec;
    } catch {
      speechRef.current = null;
    }
  }

  function stopVisualizer() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
    setLevels(buildIdleLevels());
    levelsRef.current = buildIdleLevels();
  }

  function startVisualizer(stream: MediaStream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.65;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    dataRef.current = data;

    const tick = () => {
      const node = analyserRef.current;
      const buffer = dataRef.current;
      if (!node || !buffer) return;

      node.getByteFrequencyData(buffer);
      const step = Math.max(1, Math.floor(buffer.length / BAR_COUNT));
      let peak = 0;
      const rawLevels = Array.from({ length: BAR_COUNT }, (_, index) => {
        const sample = buffer[index * step] ?? 0;
        peak = Math.max(peak, sample);
        const normalized = sample / 255;
        // Emphasize louder speech so spikes track volume clearly.
        const boosted = Math.pow(normalized, 0.55);
        return Math.max(SILENT_FLOOR, Math.min(96, SILENT_FLOOR + boosted * 86));
      });

      // Stay flat when quiet — only spike when there is real voice energy.
      const nextLevels = peak < VOICE_THRESHOLD ? buildIdleLevels() : rawLevels;

      setLevels(nextLevels);
      levelsRef.current = nextLevels;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    }, 250);
  }

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      stopSpeech();
      stopVisualizer();
    };
  }, []);

  function scrollRecorderIntoView() {
    // Let the countdown panel paint, then bring it fully on screen.
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function startRecordingWithStream(stream: MediaStream): boolean {
    setError('');
    setRecordedSec(0);
    setElapsedSec(0);
    setFrozenLevels(null);

    try {
      mediaRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const transcript = (committedRef.current || transcriptRef.current).trim();
        transcriptRef.current = transcript;
        setFrozenLevels([...levelsRef.current]);
        setRecordedSec(durationSec);
        stopSpeech();
        if (transcript) publishTranscript(transcript);
        onRecorded?.({ durationSec, transcript: transcript || undefined });
        stream.getTracks().forEach((track) => track.stop());
        mediaRef.current = null;
        recorderRef.current = null;
        stopVisualizer();
      };

      recorder.start(200);
      startVisualizer(stream);
      startSpeech();
      recordingRef.current = true;
      setRecording(true);
      onRecordingChangeRef.current?.(true);
      return true;
    } catch {
      stopVisualizer();
      recordingRef.current = false;
      setRecording(false);
      onRecordingChangeRef.current?.(false);
      return false;
    }
  }

  async function startImmediate(): Promise<boolean> {
    if (disabled || recordingRef.current) return false;
    setError('');
    setCountdown(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const armed = startRecordingWithStream(stream);
      if (!armed) {
        stream.getTracks().forEach((track) => track.stop());
        setError('Microphone access is needed to record your answer.');
        return false;
      }
      scrollRecorderIntoView();
      return true;
    } catch {
      setError('Microphone access is needed to record your answer.');
      return false;
    }
  }

  async function beginCountdownThenRecord() {
    if (disabled || recording || countdown != null) return;
    setError('');
    setCountdown(1);
    scrollRecorderIntoView();

    // Open the mic during 1–2–3 so “Start speaking” can flip straight into the bar.
    const micPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .catch(() => null as MediaStream | null);

    for (const n of [1, 2, 3] as const) {
      setCountdown(n);
      if (n === 1) scrollRecorderIntoView();
      await new Promise((r) => setTimeout(r, 700));
    }

    setCountdown('speak');
    scrollRecorderIntoView();
    const stream = await micPromise;
    await new Promise((r) => setTimeout(r, 700));

    if (!stream) {
      setCountdown(null);
      setError('Microphone access is needed to record your answer.');
      return;
    }

    // Arm recording before clearing countdown → one paint: speak → recording bar.
    const armed = startRecordingWithStream(stream);
    setCountdown(null);
    if (!armed) {
      stream.getTracks().forEach((track) => track.stop());
      setError('Microphone access is needed to record your answer.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recordingRef.current = false;
    setRecording(false);
    onRecordingChangeRef.current?.(false);
  }

  function clearRecording() {
    setRecordedSec(0);
    setElapsedSec(0);
    setFrozenLevels(null);
    setLevels(buildIdleLevels());
    levelsRef.current = buildIdleLevels();
    transcriptRef.current = '';
    committedRef.current = '';
    stopSpeech();
    onClear?.();
  }

  useImperativeHandle(ref, () => ({
    startImmediate,
    stop: stopRecording,
    isRecording: () => recordingRef.current,
  }));

  const showIdleButton = !hideIdleButton && !recording && recordedSec === 0 && countdown == null;
  const showCountdown = !hideInternalCountdown && countdown != null && !recording;
  const showRecordingBar = recording;

  return (
    <div ref={rootRef} className="space-y-2 scroll-mt-16 sm:space-y-3 sm:scroll-mt-24">
      {showCountdown ? (
        <div
          className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:min-h-[140px] sm:gap-3 sm:px-4 sm:py-5"
          role="status"
          aria-live="assertive"
        >
          <InterviewBotFace size="md" speaking={countdown === 'speak'} />
          {countdown === 'speak' ? (
            <p className="text-center text-base font-extrabold text-[#0a2e2c] sm:text-2xl">Start speaking</p>
          ) : (
            <span className="text-4xl font-black tabular-nums text-[#0a2e2c] sm:text-5xl">{countdown}</span>
          )}
        </div>
      ) : null}

      {showIdleButton ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void beginCountdownThenRecord()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 sm:w-auto sm:rounded-xl sm:py-2.5"
        >
          <span aria-hidden="true">🎤</span>
          Record Answer
        </button>
      ) : null}

      {showRecordingBar ? (
        <div className="cb-audio-recorder-box" role="status" aria-live="polite">
          <div className="cb-audio-recorder-box__head">
            <span className="cb-audio-recorder-box__status">
              <span className="cb-audio-recorder-box__dot" aria-hidden="true" />
              Recording
            </span>
            <span className="cb-audio-recorder-box__time">{formatClock(elapsedSec)}</span>
          </div>

          <div className="cb-audio-recorder-box__wave" aria-hidden="true">
            {levels.map((height, index) => (
              <span
                key={index}
                className="cb-audio-recorder-box__bar"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          <p className="cb-audio-recorder-box__hint">Speak clearly — your words appear in the text box as you talk.</p>

          <button
            type="button"
            onClick={stopRecording}
            className="cb-audio-recorder-box__stop"
          >
            Stop Recording
          </button>
        </div>
      ) : null}

      {!recording && recordedSec > 0 ? (
        <div className="cb-audio-recorder-box is-saved">
          <div className="cb-audio-recorder-box__head">
            <span className="cb-audio-recorder-box__status is-saved">Audio saved</span>
            <span className="cb-audio-recorder-box__time">{formatClock(recordedSec)}</span>
          </div>
          <div className="cb-audio-recorder-box__wave is-static" aria-hidden="true">
            {(frozenLevels ?? levels).map((height, index) => (
              <span
                key={index}
                className="cb-audio-recorder-box__bar is-static"
                style={{ height: `${Math.max(20, height * 0.55)}%` }}
              />
            ))}
          </div>
          <button type="button" onClick={clearRecording} className="cb-audio-recorder-box__clear">
            Record again
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <style jsx>{`
        .cb-audio-recorder-box {
          width: 100%;
          border: 2px solid #0a2e2c;
          border-radius: 12px;
          background: linear-gradient(180deg, #f8faf9 0%, #ffffff 100%);
          padding: 8px;
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box {
            padding: 14px 14px 12px;
          }
        }
        .cb-audio-recorder-box.is-saved {
          border-color: #86efac;
          background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
        }
        .cb-audio-recorder-box__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__head {
            margin-bottom: 10px;
          }
        }
        .cb-audio-recorder-box__status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 800;
          color: #b91c1c;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__status {
            font-size: 11px;
          }
        }
        .cb-audio-recorder-box__status.is-saved {
          color: #15803d;
        }
        .cb-audio-recorder-box__dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ef4444;
          animation: cb-audio-pulse 1s ease-in-out infinite;
        }
        .cb-audio-recorder-box__time {
          font-size: 11px;
          font-weight: 800;
          color: #0a2e2c;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__time {
            font-size: 12px;
          }
        }
        .cb-audio-recorder-box__wave {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          height: 40px;
          padding: 4px 4px;
          border-radius: 10px;
          border: 1.5px solid #dde0d3;
          background: #fff;
          overflow: hidden;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__wave {
            height: 88px;
            gap: 3px;
            padding: 10px 8px;
          }
        }
        .cb-audio-recorder-box__wave.is-static {
          background: #f8faf9;
        }
        .cb-audio-recorder-box__bar {
          flex: 1 1 0;
          min-width: 2.5px;
          max-width: 7px;
          border-radius: 999px;
          background: linear-gradient(180deg, #14b8a6 0%, #0a2e2c 100%);
          transform-origin: bottom center;
          transition: height 70ms linear;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__bar {
            min-width: 3px;
            max-width: 8px;
          }
        }
        .cb-audio-recorder-box__bar.is-static {
          background: linear-gradient(180deg, #86efac 0%, #16a34a 100%);
          transition: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .cb-audio-recorder-box__bar {
            transition: none;
          }
          .cb-audio-recorder-box__dot {
            animation: none;
          }
        }
        .cb-audio-recorder-box__hint {
          margin: 6px 0 0;
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          text-align: center;
        }
        @media (max-width: 639px) {
          .cb-audio-recorder-box__hint {
            display: none;
          }
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__hint {
            margin: 8px 0 0;
            font-size: 11px;
          }
        }
        .cb-audio-recorder-box__stop,
        .cb-audio-recorder-box__clear {
          margin-top: 6px;
          width: 100%;
          border: none;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        @media (min-width: 640px) {
          .cb-audio-recorder-box__stop,
          .cb-audio-recorder-box__clear {
            margin-top: 10px;
            padding: 12px 14px;
            font-size: 13px;
          }
        }
        .cb-audio-recorder-box__stop {
          background: #b91c1c;
          color: #fff;
        }
        .cb-audio-recorder-box__clear {
          background: #fff;
          color: #0a2e2c;
          border: 1.5px solid #dde0d3;
        }
        @keyframes cb-audio-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.45;
            transform: scale(0.85);
          }
        }
      `}</style>
    </div>
  );
});
