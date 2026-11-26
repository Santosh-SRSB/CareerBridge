'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/landing/home/icons';
import { EMPLOYER_SUPPORT_EMAIL } from '@careerbridge/shared';
import { getStoredUser } from '@/lib/session';

const STORAGE_KEY = 'cb.employerHireWaysPopup.v1';
const REGISTER_HREF = '/employer/register';
const RECRUIT_MAIL = `mailto:${EMPLOYER_SUPPORT_EMAIL}?subject=${encodeURIComponent('Managed hiring / recruitment services')}`;

let seenThisRuntime = false;

function readSeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // sessionStorage may be unavailable
  }
}

export function EmployerHireWaysPopup() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    writeSeen();
    seenThisRuntime = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    const shouldOpen = seenThisRuntime || (!getStoredUser()?.id && !readSeen());
    if (!shouldOpen) return;
    if (!seenThisRuntime) {
      seenThisRuntime = true;
      writeSeen();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    <div className="hl-launch-popup cb-hireways">
      <button
        type="button"
        className="hl-launch-popup__backdrop"
        aria-label="Dismiss hiring options"
        onClick={close}
      />
      <div
        className="hl-launch-popup__card cb-hireways__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className="hl-launch-popup__close cb-hireways__close"
          aria-label="Close hiring options"
          onClick={close}
        >
          <CloseIcon size={18} />
        </button>

        <div className="cb-hireways__floaters" aria-hidden>
          <span className="cb-hireways__bob cb-hireways__bob--a">★</span>
          <span className="cb-hireways__bob cb-hireways__bob--b">✦</span>
          <span className="cb-hireways__bob cb-hireways__bob--c">●</span>
          <span className="cb-hireways__bob cb-hireways__bob--d">+</span>
        </div>

        <header className="cb-hireways__head">
          <h2 id={titleId}>Two ways to hire with SRSB</h2>
          <p>Self-service or fully managed. You decide.</p>
        </header>

        <div className="cb-hireways__grid">
          <article className="cb-hireways__option">
            <span className="cb-hireways__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 20h8M12 18v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <p className="cb-hireways__label">Self-service</p>
            <h3>Career Bridge Platform</h3>
            <p className="cb-hireways__copy">Manage your recruitment independently through our platform.</p>
            <ul>
              <li>Register your company</li>
              <li>Subscribe to a suitable plan</li>
              <li>Post jobs and access candidate profiles</li>
              <li>Manage your recruitment activities</li>
            </ul>
            <Link href={REGISTER_HREF} className="cb-hireways__cta cb-hireways__cta--light" onClick={close}>
              Register on Career Bridge
            </Link>
          </article>

          <article className="cb-hireways__option">
            <span className="cb-hireways__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a6 6 0 0112 0M15 7a3.5 3.5 0 010 7M20 20a5 5 0 00-4-4.9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="cb-hireways__label">Managed hiring</p>
            <h3>Recruitment Services</h3>
            <p className="cb-hireways__copy">Let SRSB Workforce Solutions manage your hiring requirements.</p>
            <ul>
              <li>Share your job requirements</li>
              <li>Get dedicated recruitment support</li>
              <li>Receive screened and shortlisted candidates</li>
              <li>Pay recruitment charges upon successful placement as agreed</li>
            </ul>
            <a href={RECRUIT_MAIL} className="cb-hireways__cta cb-hireways__cta--gold" onClick={close}>
              Connect With Recruitment Team
            </a>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
}
