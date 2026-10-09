'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingFrame, OnboardingIcon, obxGhostButtonClass, obxPrimaryButtonClass } from '@/components/OnboardingFrame';
import { getCandidateMe } from '@/lib/api';
import { setupTaskStatus, SETUP_TASKS } from '@/lib/onboarding-setup';

const TASK_MS = 1000;
const REDUCED_TASK_MS = 250;
const NEXT_PATH = '/onboarding/complete';
const LOAD_ERROR = "We couldn't confirm your profile. Check your connection and try again.";

/** Shown after the last onboarding step while the saved profile is confirmed, then hands off to the resume choice. */
export default function ProfileSetupPage() {
  const router = useRouter();
  const [ticks, setTicks] = useState(0);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCandidateMe()
      .then(() => {
        if (!cancelled) setProfileReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (ticks >= SETUP_TASKS.length - 1) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const handle = window.setTimeout(() => setTicks((t) => t + 1), reduce ? REDUCED_TASK_MS : TASK_MS);
    return () => window.clearTimeout(handle);
  }, [ticks]);

  const completed = setupTaskStatus(ticks, profileReady);
  const allDone = completed >= SETUP_TASKS.length;

  useEffect(() => {
    if (!allDone) return;
    const handle = window.setTimeout(() => router.replace(NEXT_PATH), 400);
    return () => window.clearTimeout(handle);
  }, [allDone, router]);

  const retry = useCallback(() => {
    setError('');
    setAttempt((n) => n + 1);
  }, []);

  const percent = Math.round((Math.min(completed + 1, SETUP_TASKS.length) / SETUP_TASKS.length) * 100);

  return (
    <OnboardingFrame step={4} showProgress={false}>
      <div className="obx-center" aria-live="polite">
        <div className="obx-big">
          <OnboardingIcon name="briefcase" size={34} />
        </div>
        <h1>Setting up your profile</h1>
        <p className="obx-lead">This only takes a moment.</p>
        <ul className="obx-tasks">
          {SETUP_TASKS.map((task, i) => {
            const state = i < completed ? 'is-ok' : i === completed && !error ? 'is-now' : '';
            return (
              <li key={task} className={state}>
                <span className="ti" aria-hidden>
                  {i < completed ? <OnboardingIcon name="check" size={14} /> : state === 'is-now' ? <span className="obx-spin" /> : null}
                </span>
                {task}
                {i < completed ? <span className="sr-only"> (done)</span> : null}
              </li>
            );
          })}
        </ul>
        <div
          className="obx-bar"
          role="progressbar"
          aria-label="Profile setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        {error ? (
          <div role="alert" className="obx-error" style={{ justifyContent: 'center' }}>
            <span>{error}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className={obxPrimaryButtonClass} onClick={retry}>
                Try again
              </button>
              <button type="button" className={obxGhostButtonClass} onClick={() => router.replace(NEXT_PATH)}>
                Continue anyway
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </OnboardingFrame>
  );
}
