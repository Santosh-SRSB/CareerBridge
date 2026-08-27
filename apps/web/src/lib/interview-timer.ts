import type { InterviewSession } from '@careerbridge/shared';

export const ACTIVE_INTERVIEW_TIMER_KEY = 'cb.activeInterviewTimer';

export type ActiveInterviewTimer = {
  id: string;
  jobRole: string;
  mode?: string | null;
  startAt: string;
  durationLimitMin: number;
};

export function formatInterviewClock(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function remainingInterviewSec(timer: ActiveInterviewTimer, now = Date.now()) {
  const limit = Math.max(1, timer.durationLimitMin) * 60;
  const elapsed = Math.max(0, Math.round((now - new Date(timer.startAt).getTime()) / 1000));
  return Math.max(0, limit - elapsed);
}

export function persistActiveInterviewTimer(payload: ActiveInterviewTimer) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_INTERVIEW_TIMER_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event('cb-interview-timer'));
}

export function saveActiveInterviewTimer(session: InterviewSession) {
  if (typeof window === 'undefined') return;
  if (!session.startAt || session.status === 'COMPLETED') {
    clearActiveInterviewTimer(session.id);
    return;
  }
  persistActiveInterviewTimer({
    id: session.id,
    jobRole: session.jobRole || 'Interview',
    mode: session.mode || null,
    startAt: session.startAt,
    durationLimitMin: session.durationLimitMin || 15,
  });
}

export function clearActiveInterviewTimer(id?: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(ACTIVE_INTERVIEW_TIMER_KEY);
    if (raw && id) {
      const parsed = JSON.parse(raw) as ActiveInterviewTimer;
      if (parsed.id !== id) return;
    }
  } catch {
    /* ignore */
  }
  window.localStorage.removeItem(ACTIVE_INTERVIEW_TIMER_KEY);
  window.dispatchEvent(new Event('cb-interview-timer'));
}

export function readActiveInterviewTimer(): ActiveInterviewTimer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_INTERVIEW_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveInterviewTimer;
    if (!parsed?.id || !parsed.startAt) return null;
    if (remainingInterviewSec(parsed) <= 0) {
      clearActiveInterviewTimer(parsed.id);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function activeTimerFromSessions(sessions: InterviewSession[]): ActiveInterviewTimer | null {
  // Prefer a started live AI session; fall back to any started in-progress interview.
  const started = sessions.filter((item) => Boolean(item.startAt) && item.status !== 'COMPLETED');
  const live =
    started.find((item) => item.mode === 'LIVE_AI') ||
    started.find((item) => item.status === 'IN_PROGRESS') ||
    started[0];
  if (!live?.startAt) return null;
  const timer: ActiveInterviewTimer = {
    id: live.id,
    jobRole: live.jobRole || 'Interview',
    mode: live.mode || null,
    startAt: live.startAt,
    durationLimitMin: live.durationLimitMin || 15,
  };
  if (remainingInterviewSec(timer) <= 0) return null;
  return timer;
}

export function interviewResumeHref(timer: ActiveInterviewTimer) {
  if (timer.mode === 'LIVE_AI' || !timer.mode) return `/interviews/live/${timer.id}`;
  if (timer.mode === 'HUMAN') return `/interviews/human/${timer.id}/room`;
  return `/interviews/${timer.id}`;
}
