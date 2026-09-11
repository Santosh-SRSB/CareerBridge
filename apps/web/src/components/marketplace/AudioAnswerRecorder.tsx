'use client';

import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 28;

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
  return Array.from({ length: BAR_COUNT }, () => 18);
}

export function AudioAnswerRecorder({
  disabled = false,
  onRecorded,
  onClear,
  onLiveTranscript,
  onRecordingChange,
}: {
  disabled?: boolean;
  onRecorded?: (payload: { durationSec: number; transcript?: string }) => void;
  onClear?: () => void;
  /** Fires while speaking so the parent can show live captions in a text box. */
  onLiveTranscript?: (text: string) => void;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recordedSec, setRecordedSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState<number[]>(buildIdleLevels);
  const [error, setError] = useState('');

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
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;

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
      const nextLevels = Array.from({ length: BAR_COUNT }, (_, index) => {
        const sample = buffer[index * step] ?? 0;
        const normalized = sample / 255;
        const boosted = Math.pow(normalized, 0.75);
        return Math.max(12, Math.min(96, 12 + boosted * 84));
      });

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

  async function startRecording() {
    setError('');
    setRecordedSec(0);
    setElapsedSec(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      setRecording(true);
      onRecordingChangeRef.current?.(true);
    } catch {
      setError('Microphone access is needed to record your answer.');
      stopVisualizer();
      setRecording(false);
      onRecordingChangeRef.current?.(false);
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
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

  return (
    <div className="space-y-3">
      {!recording && recordedSec === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void startRecording()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 sm:w-auto sm:rounded-xl sm:py-2.5"
        >
          <span aria-hidden="true">🎤</span>
          Record Answer
        </button>
      ) : null}

      {recording ? (
        <div className="cb-audio-recorder-box" role="status" aria-live="polite">
          <div className="cb-audio-recorder-box__head">
            <span className="cb-audio-recorder-box__status">
              <span className="cb-audio-recorder-box__dot" aria-hidden="true" />
              Recording
            </span>
            <span className="cb-audio-recorder-box__time">{elapsedSec}s</span>
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
            <span className="cb-audio-recorder-box__time">{recordedSec}s</span>
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
          padding: 12px;
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
          margin-bottom: 10px;
        }
        .cb-audio-recorder-box__status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 800;
          color: #b91c1c;
          text-transform: uppercase;
          letter-spacing: 0.04em;
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
          font-size: 12px;
          font-weight: 800;
          color: #0a2e2c;
        }
        .cb-audio-recorder-box__wave {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2.5px;
          height: 64px;
          padding: 8px 6px;
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
          min-width: 3px;
          max-width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #14b8a6 0%, #0a2e2c 100%);
          transition: height 70ms linear;
          transform-origin: bottom center;
        }
        .cb-audio-recorder-box__bar.is-static {
          background: linear-gradient(180deg, #86efac 0%, #16a34a 100%);
          transition: none;
        }
        .cb-audio-recorder-box__hint {
          margin: 8px 0 0;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-align: center;
        }
        .cb-audio-recorder-box__stop,
        .cb-audio-recorder-box__clear {
          margin-top: 10px;
          width: 100%;
          border: none;
          border-radius: 999px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
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
}
