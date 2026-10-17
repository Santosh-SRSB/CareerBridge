'use client';

import { useEffect, useState } from 'react';
import {
  ANSWER_BAR_COLORS,
  ANSWER_TIME_COLORS,
  answerCountdown,
} from '@/features/mock-interview/answer-countdown';

const TICK_MS = 100;

/**
 * Horizontal answer countdown. Width and color come from a fixed deadline,
 * so the bar is a real timer rather than a looping animation.
 */
export function AnswerCountdownBar({ deadlineMs }: { deadlineMs: number }) {
  const [nowMs, setNowMs] = useState(() => performance.now());

  useEffect(() => {
    let interval = 0;
    const paint = () => {
      const now = performance.now();
      setNowMs(now);
      if (now >= deadlineMs) window.clearInterval(interval);
    };
    paint();
    if (performance.now() < deadlineMs) {
      interval = window.setInterval(paint, TICK_MS);
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') paint();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [deadlineMs]);

  const view = answerCountdown(nowMs, deadlineMs);
  const width = `${Math.max(0, Math.min(100, view.progress * 100))}%`;

  return (
    <div className="ms-answer-clock" role="timer" aria-label={`Answer time remaining ${view.label}`}>
      <div className="ms-answer-clock__top">
        <span className="ms-answer-clock__label">Answer time</span>
        <span className="ms-answer-clock__time" style={{ color: ANSWER_TIME_COLORS[view.color] }}>
          {view.label}
        </span>
      </div>
      <div className="ms-answer-clock__track">
        <div
          className="ms-answer-clock__fill"
          data-answer-color={view.color}
          style={{ width, backgroundColor: ANSWER_BAR_COLORS[view.color] }}
        />
      </div>
    </div>
  );
}
