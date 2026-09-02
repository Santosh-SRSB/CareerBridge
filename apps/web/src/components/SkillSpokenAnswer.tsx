'use client';

import { useEffect, useRef, useState } from 'react';

function pickRecorderType() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

function isLive(media: MediaStream | null) {
  return Boolean(media?.getVideoTracks().some((track) => track.readyState === 'live'));
}

function cameraMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The camera is already in use. Close Windows Camera, Teams, Zoom, and other browser tabs. Then tap Open camera.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission is blocked. Allow camera and microphone for this site, then tap Open camera.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found. Plug in a webcam and try again.';
  }
  return 'Could not open the camera. Close other camera apps, then tap Open camera.';
}

export function SkillSpokenAnswer({
  prompt,
  skill,
  index = 0,
  total = 6,
  error,
  loading,
  onSubmit,
}: {
  prompt?: string;
  skill?: string;
  index?: number;
  total?: number;
  value?: string;
  onChange?: (value: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (payload: { text: string; hasAudio: boolean; hasVoice: boolean; durationMs: number; recording?: Blob }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationRef = useRef(0);
  const clipRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const voiceStopRef = useRef<(() => void) | null>(null);
  const voiceRef = useRef({ voiced: 0, samples: 0 });
  const hasVoiceRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveMs, setLiveMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [hasClip, setHasClip] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const [opening, setOpening] = useState(false);
  const [cameraError, setCameraError] = useState('');

  function releaseCamera() {
    voiceStopRef.current?.();
    voiceStopRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.removeAttribute('src');
    }
  }

  async function attachPreview(media: MediaStream) {
    const video = videoRef.current;
    if (!video) return;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    video.controls = false;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = media;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      video.onloadedmetadata = () => resolve();
    });
    await video.play();
  }

  async function enableCamera() {
    setCameraError('');
    setOpening(true);
    releaseCamera();
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    try {
      let next: MediaStream;
      try {
        next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      } catch {
        next = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      if (!isLive(next)) {
        next.getTracks().forEach((track) => track.stop());
        throw new DOMException('Camera opened but the video track is not live.', 'NotReadableError');
      }
      streamRef.current = next;
      setStream(next);
      await attachPreview(next);
    } catch (err) {
      releaseCamera();
      setCameraError(cameraMessage(err));
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    return () => {
      releaseCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => setLiveMs(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [recording]);

  function startVoiceWatch(media: MediaStream) {
    voiceStopRef.current?.();
    voiceRef.current = { voiced: 0, samples: 0 };
    hasVoiceRef.current = false;
    setHasVoice(false);
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume();
    try {
      const source = ctx.createMediaStreamSource(media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const n = (data[i] - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / data.length);
        voiceRef.current.samples += 1;
        if (rms > 0.048) voiceRef.current.voiced += 1;
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      voiceStopRef.current = () => {
        window.cancelAnimationFrame(frame);
        void ctx.close();
        const { voiced, samples } = voiceRef.current;
        const heard = samples > 0 && voiced >= 18 && voiced / samples >= 0.06;
        hasVoiceRef.current = heard;
        setHasVoice(heard);
        voiceStopRef.current = null;
      };
    } catch {
      void ctx.close();
    }
  }

  function startRecording() {
    const media = streamRef.current;
    if (!isLive(media) || !media) {
      setCameraError('Open the camera first and wait until you see your face.');
      return;
    }
    chunksRef.current = [];
    clipRef.current = null;
    setHasClip(false);
    setHasVoice(false);
    hasVoiceRef.current = false;
    void attachPreview(media);
    startVoiceWatch(media);
    const mimeType = pickRecorderType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
    } catch {
      setCameraError('This browser could not start video recording. Try Chrome or Edge.');
      return;
    }
    recorderRef.current = recorder;
    const started = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      voiceStopRef.current?.();
      const nextDuration = Date.now() - started;
      durationRef.current = nextDuration;
      setDurationMs(nextDuration);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      clipRef.current = blob;
      setHasClip(blob.size > 0);
      setRecording(false);
      setLiveMs(nextDuration);
      const video = videoRef.current;
      if (video && blob.size > 0) {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        video.srcObject = null;
        video.src = url;
        video.muted = false;
        video.controls = true;
        void video.play().catch(() => undefined);
      }
    };
    recorder.start(250);
    setRecording(true);
    setLiveMs(0);
    window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 20000);
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  function submitClip() {
    if (!clipRef.current) {
      setCameraError('Record your face and speak for at least 8 seconds.');
      return;
    }
    if (!hasVoiceRef.current) {
      setCameraError('We did not hear speech. Record again and speak clearly for 8 to 20 seconds. Silence will not score.');
      return;
    }
    onSubmit({
      text: '',
      hasAudio: true,
      hasVoice: true,
      durationMs: durationRef.current || durationMs,
      recording: clipRef.current,
    });
  }

  const seconds = Math.max(0, Math.round((recording ? liveMs : durationMs) / 1000));
  const live = isLive(stream);
  const meter = Math.min(100, Math.round((seconds / 20) * 100));

  return (
    <div className="cb-cast">
      <p className="cb-folio-prompt">{prompt}</p>
      <div className={`cb-polaroid ${recording ? 'is-rec' : ''} ${live ? 'is-live' : ''} ${hasClip && !recording ? 'is-play' : ''}`}>
        <div className={`cb-cast-stage ${recording ? 'is-rec' : ''} ${live ? 'is-live' : ''} ${hasClip && !recording ? 'is-play' : ''}`}>
          <video ref={videoRef} autoPlay muted playsInline />
          {!live && !hasClip ? (
            <div className="cb-cast-empty">
              <strong>Camera is off</strong>
              <span>Open it, then record 8–20 seconds</span>
            </div>
          ) : null}
          <span className="cb-cast-guide" aria-hidden />
          <div className="cb-cast-chips">
            <b className={recording ? 'is-rec' : live ? 'is-live' : ''}>{recording ? 'REC' : live ? 'LIVE' : 'OFF'}</b>
            <b>{seconds}s / 20s</b>
            <b className={hasVoice ? 'is-ok' : ''}>{recording ? 'Listening' : hasClip ? (hasVoice ? 'Voice heard' : 'No speech') : 'Speak'}</b>
          </div>
          <i className="cb-cast-meter" style={{ width: `${meter}%` }} />
        </div>
        <p className="cb-polaroid-cap">
          Q{index + 1}/{total} · {skill || 'Camera'} · face + voice
        </p>
      </div>

      {cameraError || error ? <p className="cb-folio-error">{cameraError || error}</p> : null}
      {hasClip && !recording && !hasVoice ? (
        <p className="cb-folio-error">Silent clip. Record again and talk for 8 to 20 seconds.</p>
      ) : null}

      <div className="cb-cast-dock">
        <button type="button" className="cb-cast-side" disabled={opening} onClick={() => void enableCamera()}>
          {opening ? 'Opening' : live ? 'Restart' : 'Open camera'}
        </button>
        <button
          type="button"
          className={`cb-cast-rec ${recording ? 'is-on' : ''}`}
          aria-label={recording ? 'Stop recording' : 'Record'}
          onClick={recording ? stopRecording : startRecording}
        >
          <span />
        </button>
        <button type="button" className="cb-cast-side is-go" disabled={loading} onClick={submitClip}>
          {loading ? 'Scoring' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
