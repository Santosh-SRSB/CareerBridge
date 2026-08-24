'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatInterviewCountdown,
  humanInterviewJoinState,
  type HumanMockSession,
} from '@careerbridge/shared';

import { SkillMascot } from '@/components/SkillMascot';

function whenLabel(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function HumanInterviewGate({
  session,
  onReady,
  compact = false,
  hideBack = false,
}: {
  session: HumanMockSession;
  onReady?: () => void;
  compact?: boolean;
  hideBack?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const state = humanInterviewJoinState(session.scheduledAt, now);

  useEffect(() => {
    if (state.canJoin) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [state.canJoin]);

  useEffect(() => {
    if (state.canJoin) onReady?.();
  }, [state.canJoin, onReady]);

  if (state.canJoin) return null;

  return (
    <section className={compact ? 'cb-hold is-card' : 'cb-hold is-studio'}>
      <SkillMascot pose="guide" className="cb-hire-eagle" alt="" />
      <p className="cb-hold-alert">Room is locked until 5 minutes before the meeting.</p>
      <p className="cb-hold-kicker">Human interview</p>
      <h1>{session.jobRole}</h1>
      <p className="cb-hold-when">Meeting time · {whenLabel(session.scheduledAt)}</p>
      <p className="cb-hold-clock cb-hire-shimmer">{formatInterviewCountdown(state.remainingMs)}</p>
      <p className="cb-hold-open">Link opens at {whenLabel(state.opensAt)}</p>
      <p className="cb-hold-note">
        {session.interviewerName || 'Priya Kumari'} will join then. Come back when the timer ends.
      </p>
      {compact || hideBack ? null : (
        <Link href={`/interviews/human/${session.id}`} className="cb-hold-back">
          Back to booking
        </Link>
      )}
    </section>
  );
}
