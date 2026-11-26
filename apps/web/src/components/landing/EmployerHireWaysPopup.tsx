'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/landing/home/icons';
import { EmployerHireWaysCards } from '@/components/landing/EmployerHireWaysCards';
import { getStoredUser } from '@/lib/session';

const STORAGE_KEY = 'cb.employerHireWaysPopup.v3';

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
    <div className="hl-launch-popup cb-hireways cb-hireways--light">
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

        <header className="cb-hireways__head">
          <h2 id={titleId}>Two ways to hire with SRSB</h2>
          <p>Self-service or fully managed. You decide.</p>
        </header>

        <EmployerHireWaysCards onNavigate={close} />
      </div>
    </div>,
    document.body,
  );
}
