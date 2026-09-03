'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HumanMockSession, InterviewSession } from '@careerbridge/shared';
import { listHumanMocks, listInterviews } from '@/lib/api';
import {
  activeTimerFromSessions,
  formatInterviewClock,
  clearActiveInterviewTimer,
  interviewResumeHref,
  persistActiveInterviewTimer,
  readActiveInterviewTimer,
  remainingInterviewSec,
  type ActiveInterviewTimer,
} from '@/lib/interview-timer';
import { formatInterviewCountdown, humanInterviewJoinState } from '@careerbridge/shared';

type Props = {
  interviews?: InterviewSession[];
  /** compact = slim strip for top bar */
  compact?: boolean;
};

type BannerTimer =
  | {
      kind: 'ai';
      timer: ActiveInterviewTimer;
    }
  | {
      kind: 'human';
      id: string;
      jobRole: string;
      scheduledAt: string;
    };

function resolveTimer(sessions: InterviewSession[]): ActiveInterviewTimer | null {
  const fromApi = activeTimerFromSessions(sessions);
  if (fromApi && remainingInterviewSec(fromApi) > 0) {
    persistActiveInterviewTimer(fromApi);
    return fromApi;
  }
  const stored = readActiveInterviewTimer();
  if (stored && remainingInterviewSec(stored) > 0) return stored;
  return null;
}

export function ActiveInterviewTimerBanner({ interviews, compact = false }: Props) {
  const [timer, setTimer] = useState<BannerTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    // Show localStorage immediately so the banner isn't blank while API loads (AI case).
    const stored = readActiveInterviewTimer();
    if (stored) setTimer({ kind: 'ai', timer: stored });

    const refresh = async () => {
      try {
        // Always hit the API so we don't depend on a stale/empty parent prop.
        const [fromNetworkAi, fromNetworkHuman] = await Promise.all([
          listInterviews().catch(() => null),
          listHumanMocks().catch(() => null),
        ]);

        const aiSessions = fromNetworkAi ?? interviews ?? [];
        const humanSessions = fromNetworkHuman ?? [];
        if (cancelled) return;

        // Priority 1: AI interview in progress (localStorage +/or server).
        const ai = resolveTimer(aiSessions);
        if (ai) {
          setTimer({ kind: 'ai', timer: ai });
          return;
        }

        // Priority 2: Human interview that is still locked (room opens 5 minutes before).
        const nowMs = Date.now();
        const locked = (humanSessions as HumanMockSession[])
          .filter((item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED')
          .map((item) => {
            const state = humanInterviewJoinState(item.scheduledAt, nowMs);
            return { item, state };
          })
          .filter((row) => !row.state.canJoin && row.state.remainingMs > 0)
          .sort((a, b) => a.state.remainingMs - b.state.remainingMs)[0];

        if (!locked?.item) {
          setTimer(null);
          return;
        }

        setTimer({
          kind: 'human',
          id: locked.item.id,
          jobRole: locked.item.jobRole,
          scheduledAt: locked.item.scheduledAt,
        });
      } catch {
        if (cancelled) return;
        const fallback = readActiveInterviewTimer();
        if (fallback) setTimer({ kind: 'ai', timer: fallback });
        else setTimer(null);
      }
    };

    void refresh();
    const poll = window.setInterval(() => void refresh(), 4000);
    const sync = () => {
      void refresh();
    };
    window.addEventListener('storage', sync);
    window.addEventListener('cb-interview-timer', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener('storage', sync);
      window.removeEventListener('cb-interview-timer', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [interviews]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer) return;
    if (timer.kind !== 'ai') return;
    if (remainingInterviewSec(timer.timer, now) > 0) return;
    clearActiveInterviewTimer(timer.timer.id);
    setTimer(null);
  }, [timer, now]);

  if (!timer) return null;

  if (timer.kind === 'ai') {
    const remaining = remainingInterviewSec(timer.timer, now);
    if (remaining <= 0) return null;
    const urgent = remaining <= 60;

    return (
      <Link
        href={interviewResumeHref(timer.timer)}
        className={`cb-interview-timer-banner${urgent ? ' is-urgent' : ''}${compact ? ' is-compact' : ''}`}
        aria-live="polite"
      >
        <span className="cb-interview-timer-banner__pulse" aria-hidden />
        <div className="cb-interview-timer-banner__copy">
          <p className="cb-interview-timer-banner__kicker">Interview in progress</p>
          <p className="cb-interview-timer-banner__title">{timer.timer.jobRole}</p>
          {!compact ? (
            <p className="cb-interview-timer-banner__hint">Tap to return to the interview room</p>
          ) : null}
        </div>
        <div className="cb-interview-timer-banner__clock">
          <span>Time left</span>
          <strong>{formatInterviewClock(remaining)}</strong>
        </div>
      </Link>
    );
  }

  const state = humanInterviewJoinState(timer.scheduledAt, now);
  if (state.canJoin || state.remainingMs <= 0) return null;
  const urgent = state.remainingMs <= 60_000;

  const opensAtLabel = new Date(state.opensAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Link
      href={`/interviews/human/${timer.id}`}
      className={`cb-interview-timer-banner${urgent ? ' is-urgent' : ''}${compact ? ' is-compact' : ''}`}
      aria-live="polite"
    >
      <span className="cb-interview-timer-banner__pulse" aria-hidden />
      <div className="cb-interview-timer-banner__copy">
        <p className="cb-interview-timer-banner__kicker">Human interview</p>
        <p className="cb-interview-timer-banner__title">{timer.jobRole}</p>
        {!compact ? <p className="cb-interview-timer-banner__hint">Room unlocks at {opensAtLabel}</p> : null}
      </div>
      <div className="cb-interview-timer-banner__clock">
        <span>Time left</span>
        <strong>{formatInterviewCountdown(state.remainingMs)}</strong>
      </div>
    </Link>
  );
}
