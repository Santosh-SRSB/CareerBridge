'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import type { InterviewSession } from '@careerbridge/shared';
import {
  answerLiveInterview,
  endLiveInterview,
  getInterview,
  startLiveInterview,
  warnLiveInterview,
} from '@/lib/api';
import { clearActiveInterviewTimer, saveActiveInterviewTimer } from '@/lib/interview-timer';
import { greetingForHour, pickFemaleVoice, setAiThinking, setAvatarMood, startAiSpeech, stopAiSpeech } from '@/features/interview/ai-speech';
import { LOBBY_DONTS, LOBBY_DOS } from '@/features/interview/lobby-rules';

const LiveInterviewer = dynamic(() => import('@/features/interview/LiveInterviewer'), {
  ssr: false,
  loading: () => <div className="ai-world-live-skel">Connecting live interviewer...</div>,
});

const MIC_PHRASE = 'Hey Bridge AI, my mic is working?';

function notify(message: string) {
  window.alert(message);
}

function firstName(full?: string | null) {
  const part = (full || 'there').trim().split(/\s+/).filter(Boolean)[0] || 'there';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function speak(text: string, mood: 'speaking' | 'welcoming' = 'speaking') {
  return new Promise<void>((resolve) => {
    const line = text.replace(/\n+/g, ' ').trim();
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      startAiSpeech(line, mood);
      window.setTimeout(() => {
        stopAiSpeech('listening');
        resolve();
      }, Math.min(12000, 700 + line.length * 55));
      return;
    }
    const synth = window.speechSynthesis;
    synth.resume();
    let started = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stopAiSpeech('listening');
      resolve();
    };
    const run = () => {
      if (started) return;
      started = true;
      startAiSpeech(line, mood);
      const utter = new SpeechSynthesisUtterance(line);
      utter.rate = 0.94;
      utter.pitch = 1.08;
      utter.lang = 'en-IN';
      const voice = pickFemaleVoice();
      if (voice) utter.voice = voice;
      utter.onend = () => {
        window.clearTimeout(fallback);
        finish();
      };
      utter.onerror = () => {
        window.clearTimeout(fallback);
        finish();
      };
      const fallback = window.setTimeout(() => finish(), Math.min(22000, 900 + line.length * 70));
      synth.speak(utter);
      window.setTimeout(() => {
        if (synth.paused) synth.resume();
      }, 80);
    };
    if (synth.getVoices().length) {
      run();
      return;
    }
    synth.addEventListener('voiceschanged', run, { once: true });
    window.setTimeout(run, 400);
  });
}

async function naturalPause(ms = 450) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function speechCtor() {
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function isFinalYes(text: string) {
  const n = text.toLowerCase();
  if (/(add|more|wait|not yet|extra)/.test(n)) return false;
  return /^(yes|yeah|yep|ok|okay|done|final|complete|that's all|thats all|take it|go ahead|next)\b/.test(n.trim())
    || /final answer|take (it|this)|i am done|i'm done|completed/.test(n);
}

function isWantAdd(text: string) {
  const n = text.toLowerCase();
  return /(add|more|wait|not yet|extra|continue speaking|not complete)/.test(n) && !/final/.test(n);
}

function isWake(text: string) {
  const n = text.toLowerCase().replace(/[^a-z\s]/g, ' ');
  return (
    /hi\s+bridge/.test(n) ||
    /hey\s+bridge/.test(n) ||
    /high\s+bridge/.test(n) ||
    /bridge\s+a\s*i/.test(n) ||
    /bridge\s+ai/.test(n)
  );
}

function isPresence(text: string) {
  const n = text.toLowerCase().trim();
  return /^(hey+|hi+|hello|yes|yeah|haan|han|ok|okay|i am here|i'm here|present)\b/.test(n);
}

function micHeardOk(text: string) {
  const n = text.toLowerCase();
  return (
    n.includes('bridge') ||
    n.includes('mic') ||
    n.includes('working') ||
    n.includes('hey') ||
    n.split(/\s+/).length >= 4
  );
}

export default function LiveInterviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [lobbyStep, setLobbyStep] = useState<'camera' | 'mic' | 'welcome'>('camera');
  const [lobbyHint, setLobbyHint] = useState('First, test your camera.');
  const [startReady, setStartReady] = useState(false);
  const [awake, setAwake] = useState(false);
  const [listening, setListening] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [thinkLeft, setThinkLeft] = useState(0);
  const [avatarThinking, setAvatarThinking] = useState(false);
  const [showDosPopup, setShowDosPopup] = useState(false);
  const [now, setNow] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const askedAt = useRef(Date.now());
  const transRef = useRef<HTMLDivElement>(null);
  const endingRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const listenRef = useRef(false);
  const awakeRef = useRef(false);
  const presenceRef = useRef(false);
  const lastHeard = useRef(Date.now());
  const answerRef = useRef('');
  const sessionRef = useRef<InterviewSession | null>(null);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);
  const confirmingRef = useRef(false);
  const thinkRef = useRef(false);
  const capturingRef = useRef(false);
  const tabBusyRef = useRef(false);

  const name = firstName(session?.candidateName);
  const started = Boolean(session?.startAt);

  useEffect(() => {
    if (!showDosPopup) return;
    const id = window.setTimeout(() => setShowDosPopup(false), 5000);
    return () => window.clearTimeout(id);
  }, [showDosPopup]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    awakeRef.current = awake;
  }, [awake]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const load = useCallback(async () => {
    const next = await getInterview(params.id);
    setSession(next);
    if (next.status === 'COMPLETED') {
      clearActiveInterviewTimer(next.id);
      router.replace(`/interviews/${next.id}/report`);
    } else if (next.startAt) {
      saveActiveInterviewTimer(next);
    }
    return next;
  }, [params.id, router]);

  useEffect(() => {
    load().catch(() => router.replace('/login'));
  }, [load, router]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [session?.startAt, camOn, lobbyStep]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    transRef.current?.scrollTo({ top: transRef.current.scrollHeight, behavior: 'smooth' });
  }, [session?.transcript?.length, listening]);

  useEffect(() => {
    if (!session?.startAt || session.status === 'COMPLETED') return;
    saveActiveInterviewTimer(session);
    const id = window.setInterval(() => saveActiveInterviewTimer(session), 5000);
    return () => window.clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (!session?.startAt || session.status === 'COMPLETED' || endingRef.current) return;
    const limit = (session.durationLimitMin || 15) * 60;
    const elapsedSec = Math.max(0, Math.round((now - new Date(session.startAt).getTime()) / 1000));
    if (elapsedSec < limit) return;
    endingRef.current = true;
    setBusy(true);
    setStatus('Time is up. Generating your report...');
    notify('Time is up. Generating your report.');
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    void endLiveInterview(params.id).then((next) => {
      clearActiveInterviewTimer(params.id);
      router.replace(`/interviews/${next.id}/report`);
    });
  }, [now, params.id, router, session?.durationLimitMin, session?.startAt, session?.status]);

  useEffect(() => {
    const onHide = () => {
      if (!session?.startAt || session.status === 'COMPLETED') return;
      if (!document.hidden || tabBusyRef.current || endingRef.current) return;

      const count =
        sessionRef.current?.warnings?.filter((item) => item.type === 'TAB_SWITCH').length ?? 0;
      const attempt = count + 1;

      if (attempt >= 3) {
        tabBusyRef.current = true;
        endingRef.current = true;
        setBusy(true);
        setStatus('Interview ended — too many tab switches.');
        void warnLiveInterview(session.id, {
          type: 'TAB_SWITCH',
          message: 'Please stay on this tab — Attempt 3/3',
          severity: 'WARNING',
        })
          .catch(() => sessionRef.current)
          .finally(() => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            window.speechSynthesis?.cancel();
            void endLiveInterview(session.id).then((next) => {
              clearActiveInterviewTimer(session.id);
              router.replace(`/interviews/${next.id}/report`);
            });
          });
        return;
      }

      tabBusyRef.current = true;
      void warnLiveInterview(session.id, {
        type: 'TAB_SWITCH',
        message: `Please stay on this tab — Attempt ${attempt}/3`,
        severity: 'WARNING',
      }).then((next) => {
        setSession(next);
        tabBusyRef.current = false;
      });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [params.id, router, session?.id, session?.startAt, session?.status]);

  useEffect(() => {
    if (!started || !camOn || session?.status === 'COMPLETED') return;

    let cancelled = false;
    let missingSince: number | null = null;
    let warningBusy = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    type FaceDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<Array<unknown>> };
    type FaceDetectorCtor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorInstance;
    const FaceDetector = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
    const detector = FaceDetector ? new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;

    const faceLooksMissing = async (video: HTMLVideoElement) => {
      if (detector) {
        const faces = await detector.detect(video);
        return faces.length === 0;
      }
      if (!ctx) return false;
      const w = 64;
      const h = 48;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += y;
        sumSq += y * y;
        n += 1;
      }
      const mean = sum / Math.max(1, n);
      const variance = sumSq / Math.max(1, n) - mean * mean;
      // Covered lens / walked away: too dark, blown out, or almost no contrast.
      return mean < 16 || mean > 248 || variance < 90;
    };

    const tick = async () => {
      if (cancelled || endingRef.current || warningBusy || speakingRef.current) return;
      const video = videoRef.current;
      const active = sessionRef.current;
      if (!video || !active?.startAt || active.status === 'COMPLETED' || video.readyState < 2) return;

      let missing = false;
      try {
        missing = await faceLooksMissing(video);
      } catch {
        return;
      }

      if (!missing) {
        missingSince = null;
        return;
      }
      if (!missingSince) {
        missingSince = Date.now();
        return;
      }
      if (Date.now() - missingSince < 4000) return;

      warningBusy = true;
      missingSince = Date.now();
      const count = active.warnings?.filter((item) => item.type === 'FACE_MISSING').length ?? 0;
      const attempt = count + 1;
      const message =
        attempt >= 3
          ? 'Please stay on camera. Face not visible — Attempt 3/3'
          : `Please stay on camera with your face visible — Attempt ${attempt}/3`;
      setStatus(message);

      try {
        const next = await warnLiveInterview(active.id, {
          type: 'FACE_MISSING',
          message,
          severity: attempt >= 3 ? 'HIGH' : 'WARNING',
        });
        setSession(next);

        speakingRef.current = true;
        setListening(false);
        await speak('Please come back on camera. Keep your face clearly visible for the interview.');
        speakingRef.current = false;

        if (attempt >= 3) {
          endingRef.current = true;
          setBusy(true);
          setStatus('Interview ended — face not visible too many times.');
          streamRef.current?.getTracks().forEach((track) => track.stop());
          window.speechSynthesis?.cancel();
          const ended = await endLiveInterview(active.id);
          clearActiveInterviewTimer(active.id);
          router.replace(`/interviews/${ended.id}/report`);
          return;
        }

        if (listeningRef.current) {
          startListening();
          setListening(true);
          lastHeard.current = Date.now();
          setStatus('I am listening');
          setAvatarMood('listening');
        }
      } catch {
        /* ignore transient warn failures */
      } finally {
        warningBusy = false;
      }
    };

    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [camOn, params.id, router, session?.status, started]);

  useEffect(() => {
    confirmingRef.current = confirming;
  }, [confirming]);

  useEffect(() => {
    if (!started || busy) return;
    const id = window.setInterval(() => {
      if (!listeningRef.current || speakingRef.current || busyRef.current || endingRef.current) return;
      if (thinkRef.current || capturingRef.current) return;
      const draft = answerRef.current.trim();
      if (draft.length >= 8 && Date.now() - lastHeard.current >= 3000) {
        capturingRef.current = true;
        void sendAnswer();
        return;
      }
      if (draft.length === 0 && Date.now() - lastHeard.current >= 25000) {
        presenceRef.current = true;
        lastHeard.current = Date.now();
        speakingRef.current = true;
        setListening(false);
        listeningRef.current = false;
        const who = firstName(sessionRef.current?.candidateName);
        setStatus('AI is speaking...');
        void speak(`${who}, are you still with me?`).then(() => {
          speakingRef.current = false;
          presenceRef.current = false;
          setListening(true);
          listeningRef.current = true;
          lastHeard.current = Date.now();
          setStatus('I am listening');
        });
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [started, busy]);

  useEffect(() => {
    return () => {
      listenRef.current = false;
      recRef.current?.abort?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function attachStream(next: MediaStream) {
    const merged = streamRef.current || new MediaStream();
    next.getTracks().forEach((track) => {
      const same = merged.getTracks().find((item) => item.kind === track.kind);
      if (same) {
        same.stop();
        merged.removeTrack(same);
      }
      merged.addTrack(track);
    });
    streamRef.current = merged;
    if (videoRef.current) videoRef.current.srcObject = merged;
  }

  async function testCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      await attachStream(stream);
      setCamOn(true);
      setCamOk(true);
      setStatus('Camera is working fine');
      setLobbyHint('Camera is working fine');
    } catch {
      setCamOk(false);
      setCamOn(false);
      setStatus('Camera could not start. Allow camera permission and try again.');
      setLobbyHint('Camera could not start. Allow camera permission and try again.');
    }
  }

  function listenOnce(onText: (text: string) => void) {
    const Ctor = speechCtor();
    if (!Ctor) {
      onText('');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || '';
      onText(text);
    };
    rec.onend = () => undefined;
    rec.start();
  }

  function testMicrophone() {
    const Ctor = speechCtor();
    if (!Ctor) {
      setStatus('This browser cannot test speech. You can still type answers.');
      setLobbyHint('This browser cannot test speech. You can still type answers.');
      setMicOk(true);
      setMicTesting(false);
      return;
    }
    setMicTesting(true);
    setMicOk(false);
    setStatus('Listening');
    setLobbyHint('Listening… say the line below');
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => attachStream(stream))
      .then(() => {
        listenOnce((text) => {
          setMicTesting(false);
          if (micHeardOk(text)) {
            setMicOk(true);
            setStatus('Audio is working fine');
            setLobbyHint('Audio is working fine');
          } else {
            setMicOk(false);
            setStatus('I could not hear that clearly. Try again, a little louder.');
            setLobbyHint('I could not hear that clearly. Try again, a little louder.');
          }
        });
      })
      .catch(() => {
        setMicTesting(false);
        setMicOk(false);
        setStatus('Microphone permission was denied.');
        setLobbyHint('Microphone permission was denied.');
      });
  }

  async function playWelcome() {
    setLobbyStep('welcome');
    setStartReady(true);
    setAvatarMood('welcoming');
    const line = `${greetingForHour()}. Welcome to your Career Bridge interview. Be relaxed, and once you are ready, click Start to begin.`;
    setStatus('When you are ready, click Start');
    await naturalPause(350);
    await speak(line, 'welcoming');
    setShowDosPopup(true);
  }

  function startListening() {
    const Ctor = speechCtor();
    if (!Ctor || listenRef.current) return;
    listenRef.current = true;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      if (speakingRef.current || thinkRef.current || busyRef.current) return;
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript || '';
      if (!text.trim()) return;
      lastHeard.current = Date.now();
      if (!last.isFinal) return;
      void onHeard(text.trim());
    };
    rec.onend = () => {
      if (listenRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore restart races */
        }
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      listenRef.current = false;
    }
  }

  async function waitThink(seconds: number) {
    thinkRef.current = true;
    let left = seconds;
    setThinkLeft(left);
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        left -= 1;
        setThinkLeft(Math.max(0, left));
        if (left <= 0) {
          window.clearInterval(id);
          thinkRef.current = false;
          resolve();
        }
      }, 1000);
    });
  }

  async function presentQuestion(question: { prompt?: string | null; snippet?: string | null; thinkSeconds?: number } | null) {
    if (!question?.prompt) {
      setListening(true);
      listeningRef.current = true;
      lastHeard.current = Date.now();
      setStatus('I am listening');
      setAvatarMood('listening');
      return;
    }
    setConfirming(false);
    confirmingRef.current = false;
    setListening(false);
    listeningRef.current = false;
    speakingRef.current = true;
    setStatus('AI is speaking...');
    await naturalPause(280);
    await speak(question.prompt);
    if ((question.thinkSeconds || 0) > 0) {
      await waitThink(question.thinkSeconds || 0);
      await speak('Take a moment if you need it. Now please explain your answer.');
    }
    speakingRef.current = false;
    setListening(true);
    listeningRef.current = true;
    lastHeard.current = Date.now();
    setStatus('I am listening');
    setAvatarMood('listening');
  }

  async function onHeard(text: string) {
    if (busyRef.current || endingRef.current || thinkRef.current || speakingRef.current) return;
    const current = sessionRef.current;
    if (!current?.startAt) return;

    if (confirmingRef.current) {
      lastHeard.current = Date.now();
      if (isWantAdd(text)) {
        confirmingRef.current = false;
        setConfirming(false);
        speakingRef.current = true;
        await speak('Of course. Please add whatever you want to the same answer.');
        speakingRef.current = false;
        setListening(true);
        listeningRef.current = true;
        setStatus('I am listening');
        return;
      }
      if (isFinalYes(text) || /^(yes|yeah|ok|okay|done)\b/i.test(text.trim())) {
        confirmingRef.current = false;
        setConfirming(false);
        void sendAnswer();
        return;
      }
      setAnswer((prev) => `${prev} ${text}`.trim());
      confirmingRef.current = false;
      setConfirming(false);
      return;
    }

    if (!awakeRef.current) {
      if (isWake(text)) {
        setAwake(true);
        awakeRef.current = true;
        lastHeard.current = Date.now();
        presenceRef.current = false;
        setListening(false);
        speakingRef.current = true;
        setStatus('AI is speaking...');
        await speak(`Yes ${firstName(current.candidateName)}, I am right here with you.`);
        const prompt = current.currentQuestion?.prompt;
        if (prompt) await speak(prompt);
        speakingRef.current = false;
        setListening(true);
        listeningRef.current = true;
        lastHeard.current = Date.now();
        setStatus('I am listening');
      }
      return;
    }

    if (presenceRef.current) {
      if (isPresence(text) || isWake(text) || /yes|hey|hi/.test(text.toLowerCase())) {
        presenceRef.current = false;
        lastHeard.current = Date.now();
        setListening(false);
        speakingRef.current = true;
        setStatus('AI is speaking...');
        await speak('Alright, thank you. Let us continue.');
        const prompt = current.currentQuestion?.prompt;
        if (prompt) await speak(prompt);
        speakingRef.current = false;
        setListening(true);
        listeningRef.current = true;
        lastHeard.current = Date.now();
        setStatus('I am listening');
      }
      return;
    }

    if (isWake(text)) {
      lastHeard.current = Date.now();
      setListening(false);
      speakingRef.current = true;
      await speak(`Yes ${firstName(current.candidateName)}, I am here. Please go ahead.`);
      speakingRef.current = false;
      setListening(true);
      lastHeard.current = Date.now();
      setStatus('I am listening');
      return;
    }

    if (isPresence(text) && text.split(/\s+/).length < 4) {
      lastHeard.current = Date.now();
      return;
    }

    setAnswer((prev) => `${prev} ${text}`.trim());
    lastHeard.current = Date.now();
    setStatus('I am listening');
  }

  async function begin() {
    window.speechSynthesis?.cancel();
    stopAiSpeech('welcoming');
    const intro = `${greetingForHour()}. Welcome to your Career Bridge interview. Before we begin, could you please introduce yourself? Tell me who you are, what you have been doing, and what you want from this role.`;
    setBusy(true);
    setAwake(true);
    awakeRef.current = true;
    setListening(false);
    speakingRef.current = true;
    setStatus('AI is speaking...');
    window.speechSynthesis?.resume();
    await naturalPause(400);
    const voicePromise = speak(intro, 'welcoming');
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        await attachStream(stream);
        setCamOn(true);
      }
      const next = await startLiveInterview(params.id);
      setSession(next);
      saveActiveInterviewTimer(next);
      askedAt.current = Date.now();
      window.requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
      });
      await voicePromise;
      speakingRef.current = false;
      startListening();
      setListening(true);
      listeningRef.current = true;
      lastHeard.current = Date.now();
      setStatus('I am listening');
      setAvatarMood('listening');
    } finally {
      speakingRef.current = false;
      setBusy(false);
    }
  }

  async function sendAnswer() {
    const current = sessionRef.current;
    const text = answerRef.current.trim();
    if (!current || text.length < 2) {
      capturingRef.current = false;
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setConfirming(false);
    confirmingRef.current = false;
    setListening(false);
    listeningRef.current = false;
    setStatus('Thinking...');
    setAvatarThinking(true);
    setAiThinking(true);
    const durationSec = Math.round((Date.now() - askedAt.current) / 1000);
    try {
      const [next] = await Promise.all([
        answerLiveInterview(current.id, text, durationSec),
        naturalPause(900 + Math.min(1200, text.length * 8)),
      ]);
      setAiThinking(false);
      setAvatarThinking(false);
      setAnswer('');
      answerRef.current = '';
      setSession(next);
      askedAt.current = Date.now();
      if (next.conductWarning) {
        setAnswer('');
        answerRef.current = '';
        setAiThinking(false);
        setAvatarThinking(false);
        speakingRef.current = true;
        setStatus('AI is speaking...');
        await speak(next.conductWarning);
        speakingRef.current = false;
        if (next.conductTerminated || next.status === 'COMPLETED') {
          listenRef.current = false;
          recRef.current?.abort?.();
          streamRef.current?.getTracks().forEach((track) => track.stop());
          window.speechSynthesis?.cancel();
          stopAiSpeech('neutral');
          clearActiveInterviewTimer(next.id);
          router.replace(`/interviews/${next.id}/report`);
          return;
        }
        startListening();
        setListening(true);
        listeningRef.current = true;
        lastHeard.current = Date.now();
        setStatus('I am listening');
        setAvatarMood('listening');
        return;
      }
      if (next.status === 'COMPLETED') {
        listenRef.current = false;
        recRef.current?.abort?.();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        window.speechSynthesis?.cancel();
        stopAiSpeech('neutral');
        router.replace(`/interviews/${next.id}/report`);
        return;
      }
      await speak('Thank you. That is helpful.');
      await presentQuestion(next.currentQuestion);
      setAwake(true);
      awakeRef.current = true;
    } finally {
      setAiThinking(false);
      setAvatarThinking(false);
      capturingRef.current = false;
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function quit() {
    if (endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    listenRef.current = false;
    recRef.current?.abort?.();
    setStatus('Generating your report...');
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
      const next = await endLiveInterview(params.id);
      clearActiveInterviewTimer(params.id);
      router.replace(`/interviews/${next.id}/report`);
    } finally {
      setBusy(false);
      setConfirmQuit(false);
    }
  }

  if (!session) {
    return (
      <div className="ai-world is-dark">
        <p className="ai-world-wait">Opening AI interview world...</p>
      </div>
    );
  }

  const elapsed = started ? Math.max(0, Math.round((now - new Date(session.startAt!).getTime()) / 1000)) : 0;
  const remaining = Math.max(0, (session.durationLimitMin || 15) * 60 - elapsed);
  const qn = (session.liveQuestions?.filter((item) => item.answer).length || 0) + (session.currentQuestion ? 1 : 0);
  const lastWarning = session.warnings?.at(-1);

  return (
    <div className={`ai-world is-${theme}`}>
      <header className="ai-world-top">
        <p>CAREER BRIDGE AI INTERVIEW</p>
        <div className="ai-world-meta">
          <span>Start {session.startAt ? new Date(session.startAt).toLocaleTimeString() : '--'}</span>
          <span>Elapsed {fmt(elapsed)}</span>
          <span>Remaining {fmt(remaining)}</span>
          <span>Question {qn} / 15</span>
          {session.focusStacks?.length ? <span>Focus {session.focusStacks.join(' · ')}</span> : null}
        </div>
        <div className="ai-world-themes">
          <button type="button" className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')}>
            Dark mode
          </button>
          <button type="button" className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')}>
            Light mode
          </button>
        </div>
      </header>

      {!started ? (
        <div className="ai-world-stage is-lobby">
          <div className="ai-world-avatar-frame is-orb-only">
            <LiveInterviewer listening={micTesting || lobbyStep === 'mic'} thinking={false} />
            {camOn ? (
              <div className="ai-world-you-pip">
                <video ref={videoRef} autoPlay muted playsInline />
                <span>You</span>
              </div>
            ) : null}
          </div>
          <div className="ai-world-lobby">
          {lobbyStep === 'camera' ? (
            <>
              <h1>Career Bridge AI Interview</h1>
              <p>First, test your camera.</p>
              <p className={camOk ? 'ai-world-ok' : 'ai-world-status'}>{lobbyHint}</p>
              {!camOn ? <video ref={videoRef} className="ai-world-preview" autoPlay muted playsInline /> : null}
              <div className="ai-world-actions">
                <button type="button" onClick={() => void testCamera()}>
                  Test camera
                </button>
                {camOk ? (
                  <button
                    type="button"
                    className="is-start"
                    onClick={() => {
                      setLobbyStep('mic');
                      setMicTesting(false);
                      setLobbyHint('Hey Bridge AI, my mic is working?');
                      setStatus('Ready for microphone test');
                    }}
                  >
                    Next: Test audio
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {lobbyStep === 'mic' ? (
            <>
              <h1>Career Bridge AI Interview</h1>
              <p>When you are ready, click Test audio and say:</p>
              <blockquote className="ai-world-phrase">Hey Bridge AI, my mic is working?</blockquote>
              <p className={micOk ? 'ai-world-ok' : micTesting ? 'ai-world-listening' : 'ai-world-status'}>
                {micTesting ? 'Listening…' : lobbyHint}
              </p>
              <div className="ai-world-actions">
                <button type="button" disabled={micTesting} onClick={testMicrophone}>
                  {micTesting ? 'Listening…' : 'Test audio'}
                </button>
                {micOk ? (
                  <button type="button" className="is-start" onClick={() => void playWelcome()}>
                    Continue
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {lobbyStep === 'welcome' ? (
            <>
              <h1>Career Bridge AI Interview</h1>
              <p className="ai-world-hello">
                {greetingForHour()}. Welcome to your Career Bridge interview. Be relaxed, and once you are ready, click Start to begin.
              </p>
              <div className="ai-world-start-pop">
                <button type="button" className="is-start" disabled={busy} onClick={() => void begin()}>
                  Start
                </button>
                <span>Timer starts only after you click Start.</span>
              </div>
            </>
          ) : null}
          </div>
        </div>
      ) : (
        <div className="ai-world-stage is-live">
          <div className="ai-world-avatar-frame is-orb-only">
            <LiveInterviewer listening={listening} thinking={avatarThinking} />
            <div className="ai-world-you-pip">
              <video ref={videoRef} autoPlay muted playsInline />
              <span>{camOn ? 'You · live' : 'Camera off'}</span>
            </div>
            <button type="button" className="ai-world-quit is-overlay" onClick={() => setConfirmQuit(true)}>
              Quit
            </button>
          </div>
          <div className="ai-world-grid is-panel">
          <section className="ai-world-speech">
            <p className="ai-world-kicker">
              {statusDot(status)} {status}
            </p>
            {lastWarning ? <p className="ai-world-alert">{lastWarning.message}</p> : null}
            <div className="ai-world-copy">
              {(session.currentQuestion?.prompt || 'Interview in progress').split(/\n\n+/).map((para, index) => (
                <p key={`${index}-${para.slice(0, 12)}`}>{para}</p>
              ))}
            </div>
            {session.currentQuestion?.snippet ? (
              <pre className="ai-world-snippet">{session.currentQuestion.snippet}</pre>
            ) : null}
            {thinkLeft > 0 ? <p className="ai-world-think">Think · {thinkLeft}s</p> : null}
            <div className="ai-world-turns" ref={transRef}>
              {(session.transcript || []).map((item, index) => (
                <article key={`${item.at}-${index}`} className={item.role === 'ai' ? 'is-ai' : 'is-you'}>
                  <strong>{item.role === 'ai' ? 'Career Bridge AI' : 'You'}</strong>
                  <span className="ai-world-para">{item.text}</span>
                </article>
              ))}
              {answer.trim() ? (
                <article className="is-you">
                  <strong>You</strong>
                  <span className="ai-world-para">{answer.trim()}</span>
                </article>
              ) : null}
              {confirming ? (
                <article className="is-ai">
                  <strong>Career Bridge AI</strong>
                  <span className="ai-world-para">
                    Did you complete that? Should I take this as your final answer, or do you want to add more?
                  </span>
                </article>
              ) : null}
              {listening ? (
                <article className="is-ai is-listening">
                  <strong>Career Bridge AI</strong>
                  <span>I am listening</span>
                  <span className="ai-world-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </article>
              ) : null}
            </div>
          </section>

          <form
            className="ai-world-bar"
            onSubmit={(event) => {
              event.preventDefault();
              void sendAnswer();
            }}
          >
            <button type="button" onClick={startListening} aria-label="Microphone">
              🎤
            </button>
            <input
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                lastHeard.current = Date.now();
              }}
              placeholder="Speak or type your answer, then Send"
              disabled={busy}
            />
            <button type="submit" disabled={busy || answer.trim().length < 2}>
              Send
            </button>
          </form>
          </div>
        </div>
      )}

      {showDosPopup && lobbyStep === 'welcome' && !started ? (
        <div className="ai-world-rules-modal">
          <div className="ai-world-rules-card">
            <button type="button" className="ai-world-rules-close" aria-label="Close" onClick={() => setShowDosPopup(false)}>
              ×
            </button>
            <h2>Do&apos;s &amp; Don&apos;ts</h2>
            <div className="ai-world-rules-grid">
              <section>
                <h3>Do&apos;s</h3>
                <ul>{LOBBY_DOS.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section>
                <h3>Don&apos;ts</h3>
                <ul>{LOBBY_DONTS.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {confirmQuit ? (
        <div className="ai-world-modal">
          <div>
            <p>Quit and analyse everything so far?</p>
            <span>We keep start/end time, question count, your answers, and write better versions without inventing facts.</span>
            <div>
              <button type="button" onClick={() => setConfirmQuit(false)}>
                Continue interview
              </button>
              <button type="button" className="is-quit" disabled={busy} onClick={() => void quit()}>
                {busy ? 'Analysing...' : 'Quit & get report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function statusDot(status: string) {
  if (status.toLowerCase().includes('speak')) return '🔵';
  if (status.toLowerCase().includes('process') || status.toLowerCase().includes('generat')) return '🟡';
  if (status.toLowerCase().includes('listen')) return '🟢';
  return '⚪';
}

type SpeechResult = {
  isFinal?: boolean;
  0?: { transcript: string };
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<SpeechResult> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort?: () => void;
};
