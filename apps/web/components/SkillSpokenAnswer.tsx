'use client';

import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

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
    return 'The camera is already in use. Close Windows Camera, Teams, Zoom, and other browser tabs. Then tap Enable camera.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission is blocked. Allow camera and microphone for this site, then tap Enable camera.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found. Plug in a webcam and try again.';
  }
  return 'Could not open the camera. Close other camera apps, then tap Enable camera.';
}

export function SkillSpokenAnswer({
  prompt,
  skill,
  value,
  onChange,
  error,
  loading,
  onSubmit,
}: {
  prompt?: string;
  skill?: string;
  value: string;
  onChange: (value: string) => void;
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
    if (!isLive(media)) {
      setCameraError('Enable the camera first and wait until you see your face.');
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

  const seconds = Math.max(0, Math.round((recording ? liveMs : durationMs) / 1000));
  const live = isLive(stream);

  const meter = Math.min(100, Math.round((seconds / 20) * 100));

  return (
    <div className="cb-booth">
      <div className="cb-booth-copy">
        <div className="cb-booth-head">
          <span className={`cb-booth-live ${live ? 'is-on' : ''} ${recording ? 'is-rec' : ''}`}>
            {recording ? 'REC' : live ? 'LIVE' : 'STANDBY'}
          </span>
          <span className={`cb-voice-pill ${hasVoice ? 'is-on' : recording ? 'is-listen' : ''}`}>
            {recording ? 'Listening…' : hasClip ? (hasVoice ? 'Voice heard' : 'No speech') : `${seconds}s · speak to score`}
          </span>
        </div>
        {skill ? <p className="cb-check-kicker">03 · Camera · {skill}</p> : null}
        {prompt ? <h2 className="text-base font-extrabold leading-snug text-primary">{prompt}</h2> : null}
        <p className="text-xs leading-5 text-muted">
          Face the small camera on the right. Sit straight, show your shoulders, look at the lens, speak 8–20 seconds. Close Windows Camera, Teams, or Zoom first.
        </p>
        <div className="cb-booth-meter" aria-hidden>
          <i style={{ width: `${meter}%` }} />
          <em />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="md" variant="secondary" block={false} className="cb-studio-btn" loading={opening} loadingLabel="Opening..." onClick={() => void enableCamera()}>
            {live ? 'Restart camera' : 'Enable camera'}
          </Button>
          <Button
            type="button"
            size="md"
            variant={recording ? 'destructive' : 'tertiary'}
            block={false}
            className="cb-studio-btn"
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? 'Stop' : hasClip ? 'Record again' : 'Record'}
          </Button>
          <Button
            type="button"
            size="md"
            block={false}
            className="cb-studio-btn"
            loading={loading}
            loadingLabel="Scoring..."
            onClick={() => {
              if (!clipRef.current) {
                setCameraError('Record your face and speak for at least 8 seconds.');
                return;
              }
              if (!hasVoiceRef.current) {
                setCameraError('We did not hear speech. Record again and speak clearly for 8 to 20 seconds. Silence will not score.');
                return;
              }
              onSubmit({
                text: value.trim(),
                hasAudio: true,
                hasVoice: true,
                durationMs: durationRef.current || durationMs,
                recording: clipRef.current,
              });
            }}
          >
            Submit clip
          </Button>
        </div>
        {cameraError ? <p className="text-xs text-error">{cameraError}</p> : null}
        {error ? <p className="text-xs text-error">{error}</p> : null}
        {hasClip && !recording ? (
          <p className={`text-xs font-semibold ${hasVoice ? 'text-success' : 'text-error'}`}>
            {hasVoice
              ? 'Face and voice heard. Submit to score this answer. The clip is not stored.'
              : 'This clip has no speech. Record again and talk for 8 to 20 seconds. Silent clips score 0.'}
          </p>
        ) : null}
        <Textarea
          label="Optional note"
          name="spokenAnswer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Optional. We analyse the clip, then save only your score."
          className="cb-type-field min-h-16"
        />
      </div>

      <aside className={`cb-booth-cam ${opening ? 'is-open' : ''} ${live ? 'is-live' : ''}`}>
        <div className={`cb-face cb-booth-stage ${recording ? 'is-rec' : ''} ${hasClip && !recording ? 'is-play' : ''} ${live || recording ? 'cb-face-glow' : ''}`}>
          <i className="cb-booth-iris" />
          <i className="cb-booth-scan" />
          <i className="cb-booth-corner tl" />
          <i className="cb-booth-corner tr" />
          <i className="cb-booth-corner bl" />
          <i className="cb-booth-corner br" />
          <span className="cb-booth-oval" />
          <video ref={videoRef} autoPlay muted playsInline />
          {!live && !hasClip ? <div className="cb-face-empty">Off</div> : null}
          {recording ? (
            <div className="cb-wavebars" aria-hidden>
              {Array.from({ length: 8 }, (_, index) => (
                <i key={index} style={{ animationDelay: `${index * 70}ms` }} />
              ))}
            </div>
          ) : null}
          <span className="cb-face-badge">
            {recording ? `REC ${seconds}s` : hasClip ? `${Math.max(1, seconds)}s` : live ? 'Live' : 'Off'}
          </span>
        </div>
      </aside>
    </div>
  );
}
