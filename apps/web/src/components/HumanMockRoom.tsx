'use client';

import { useEffect, useRef, useState } from 'react';
import { completeHumanMock, joinHumanMock, peekHumanSignal, postHumanSignal } from '@/lib/api';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function isLive(media: MediaStream | null) {
  return Boolean(media?.getVideoTracks().some((track) => track.readyState === 'live'));
}

export function HumanMockRoom({
  id,
  role,
  token,
  jobRole,
  peerName,
  onScored,
}: {
  id: string;
  role: 'candidate' | 'interviewer';
  token?: string;
  jobRole: string;
  peerName?: string;
  onScored?: (nextId: string) => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const voiceStopRef = useRef<(() => void) | null>(null);
  const hadVoiceRef = useRef(false);
  const interviewerSeenRef = useRef(false);
  const startedRef = useRef(Date.now());
  const transcriptRef = useRef('');
  const lastInterimRef = useRef('');
  const keepListeningRef = useRef(true);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const offerSent = useRef(false);
  const answerSet = useRef(false);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [remoteOn, setRemoteOn] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [left, setLeft] = useState(false);
  const [opening, setOpening] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    document.body.classList.add('cb-meet-lock');
    return () => {
      document.body.classList.remove('cb-meet-lock');
      keepListeningRef.current = false;
      try {
        speechRef.current?.stop();
      } catch {
        /* ignore */
      }
      speechRef.current = null;
      stopVoice();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    startedRef.current = Date.now();
    const clock = window.setInterval(() => setSeconds(Math.round((Date.now() - startedRef.current) / 1000)), 500);
    return () => window.clearInterval(clock);
  }, [live]);

  function stopVoice() {
    const stop = voiceStopRef.current;
    voiceStopRef.current = null;
    try {
      stop?.();
    } catch {
      /* already closed */
    }
  }

  function watchVoice(media: MediaStream) {
    stopVoice();
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
      let voiced = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const n = (data[i] - 128) / 128;
          sum += n * n;
        }
        if (Math.sqrt(sum / data.length) > 0.048) {
          voiced += 1;
          if (voiced > 12) hadVoiceRef.current = true;
        }
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      voiceStopRef.current = () => {
        window.cancelAnimationFrame(frame);
        if (ctx.state !== 'closed') {
          void ctx.close().catch(() => undefined);
        }
      };
    } catch {
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => undefined);
      }
    }
  }

  async function attachLocal(media: MediaStream) {
    streamRef.current = media;
    setLive(true);
    const video = localRef.current;
    if (video) {
      video.srcObject = media;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => undefined);
    }
    watchVoice(media);
    startTranscript();
  }

  function startTranscript() {
    const Speech =
      (window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
        .SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Speech || speechRef.current) return;
    keepListeningRef.current = true;
    const rec = new Speech();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = (event) => {
      let extra = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i];
        if (piece.isFinal) extra += ` ${piece[0].transcript}`;
        else interim += ` ${piece[0].transcript}`;
      }
      lastInterimRef.current = interim.trim();
      if (extra.trim()) {
        hadVoiceRef.current = true;
        transcriptRef.current = `${transcriptRef.current} ${extra}`.replace(/\s+/g, ' ').trim();
      }
    };
    rec.onend = () => {
      if (!keepListeningRef.current) return;
      try {
        rec.start();
      } catch {
        /* already running */
      }
    };
    rec.start();
    speechRef.current = rec;
  }

  type SpeechRec = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };

  async function startCall() {
    if (opening || live) return;
    setError('');
    setOpening(true);
    try {
      if (!joinedRef.current) {
        await joinHumanMock(id, role, token);
        joinedRef.current = true;
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      startedRef.current = Date.now();
      setSeconds(0);
      await attachLocal(media);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'BUSINESS_RULE_VIOLATION') {
        setError(err instanceof Error ? err.message : 'This room is not open yet.');
      } else {
        setError('Allow camera and microphone, then tap Start.');
      }
    } finally {
      setOpening(false);
    }
  }

  async function ensurePeer() {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection(ICE);
    peerRef.current = peer;
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current!));
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void postHumanSignal(id, { role, kind: 'ice', payload: event.candidate.toJSON(), token });
      }
    };
    peer.ontrack = (event) => {
      interviewerSeenRef.current = true;
      setRemoteOn(true);
      const remote = remoteRef.current;
      if (remote) {
        remote.srcObject = event.streams[0];
        void remote.play().catch(() => undefined);
      }
    };
    return peer;
  }

  useEffect(() => {
    if (!live) return;
    const poll = window.setInterval(() => {
      void (async () => {
        const peer = await ensurePeer();
        const bag = await peekHumanSignal(id, role, token);
        if (role === 'candidate' && !offerSent.current) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await postHumanSignal(id, { role, kind: 'offer', payload: offer, token });
          offerSent.current = true;
        }
        if (role === 'interviewer' && bag.offer && peer.signalingState === 'stable' && !peer.currentRemoteDescription) {
          await peer.setRemoteDescription(bag.offer as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await postHumanSignal(id, { role, kind: 'answer', payload: answer, token });
        }
        if (role === 'candidate' && bag.answer && !answerSet.current) {
          await peer.setRemoteDescription(bag.answer as RTCSessionDescriptionInit);
          answerSet.current = true;
        }
        for (const item of bag.ice) {
          try {
            await peer.addIceCandidate(item as RTCIceCandidateInit);
          } catch {
            /* ignore */
          }
        }
      })().catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(poll);
  }, [id, live, role, token]);

  function flushTranscript() {
    if (lastInterimRef.current) {
      transcriptRef.current = `${transcriptRef.current} ${lastInterimRef.current}`.replace(/\s+/g, ' ').trim();
      lastInterimRef.current = '';
    }
  }

  function hangUp() {
    keepListeningRef.current = false;
    flushTranscript();
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
    stopVoice();
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
    setRemoteOn(false);
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  function toggleCam() {
    const next = !camOff;
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCamOff(next);
  }

  async function endCall() {
    if (role !== 'candidate' || ending) {
      hangUp();
      setLeft(true);
      return;
    }
    setEnding(true);
    try {
      flushTranscript();
      const next = await completeHumanMock(id, {
        durationMs: Date.now() - startedRef.current,
        hadVideo: isLive(streamRef.current) && !camOff,
        hadVoice: hadVoiceRef.current || Boolean(transcriptRef.current),
        interviewerJoined: interviewerSeenRef.current,
        transcript: transcriptRef.current,
      });
      hangUp();
      onScored?.(next.id);
    } catch (err) {
      setEnding(false);
      setError(err instanceof Error ? err.message : 'We could not score this interview.');
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const otherLabel = peerName || (role === 'interviewer' ? 'Candidate' : 'Interviewer');
  const status = !live ? 'Ready' : remoteOn ? 'Live' : 'Waiting';

  if (left) {
    return (
      <div className="cb-meet cb-meet-left">
        <p>You left the room.</p>
        <p>Video was not saved.</p>
      </div>
    );
  }

  return (
    <div className={`cb-meet ${remoteOn ? 'has-remote' : ''} ${live ? 'is-live' : ''}`}>
      <div className="cb-meet-stage">
        <figure className="cb-meet-main">
          <video ref={remoteRef} autoPlay playsInline />
          {remoteOn ? <figcaption>{otherLabel}</figcaption> : null}
        </figure>
        <figure className={`cb-meet-self ${camOff ? 'is-off' : ''}`}>
          <video ref={localRef} autoPlay muted playsInline />
          {camOff ? <div className="cb-meet-off">Camera off</div> : null}
          {live ? (
            <figcaption>
              You
              {muted ? ' · muted' : ''}
            </figcaption>
          ) : null}
        </figure>
      </div>

      <header className="cb-meet-bar">
        <div className="cb-meet-brand">
          <small>CareerBridge</small>
          <p>{jobRole}</p>
        </div>
        <b>
          {mm}:{ss}
        </b>
        <span className={live && remoteOn ? 'is-live' : ''}>{status}</span>
      </header>

      {!live ? (
        <div className="cb-meet-permit">
          <p>{opening ? 'Starting camera…' : error || 'Tap Start to turn on your camera.'}</p>
          <button type="button" className="cb-hire-shimmer" disabled={opening} onClick={() => void startCall()}>
            {opening ? 'Starting…' : 'Start'}
          </button>
        </div>
      ) : error ? (
        <p className="cb-meet-error">{error}</p>
      ) : null}

      {live ? (
        <div className="cb-meet-dock">
          <button type="button" className={muted ? 'is-on' : ''} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            <MicIcon off={muted} />
            <span>{muted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button type="button" className={camOff ? 'is-on' : ''} onClick={toggleCam} aria-label={camOff ? 'Camera on' : 'Camera off'}>
            <CamIcon off={camOff} />
            <span>{camOff ? 'Cam on' : 'Camera'}</span>
          </button>
          <button type="button" className="is-end" disabled={ending} onClick={() => void endCall()}>
            <EndIcon />
            <span>{role === 'candidate' ? (ending ? 'Scoring' : 'End') : 'Leave'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z" />
      {off ? <path d="M4 4.4 5.4 3 20 17.6 18.6 19z" /> : null}
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 7.5h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm12 2.4 4.2-2.3v8.8l-4.2-2.3z" />
      {off ? <path d="M3.2 4.6 4.6 3.2 20.8 19.4 19.4 20.8z" /> : null}
    </svg>
  );
}

function EndIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6.6 10.8a15 15 0 0 1 10.8 0l1.5-1.5a1.5 1.5 0 0 1 2.2.1 17.8 17.8 0 0 1 0 5.2 1.5 1.5 0 0 1-2.2.1l-1.5-1.5a15 15 0 0 1-10.8 0L5.1 13.7a1.5 1.5 0 0 1-2.2-.1 17.8 17.8 0 0 1 0-5.2 1.5 1.5 0 0 1 2.2-.1z" />
    </svg>
  );
}
