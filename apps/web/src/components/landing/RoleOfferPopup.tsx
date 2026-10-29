'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/landing/home/icons';
import { getStoredUser } from '@/lib/session';

type Role = 'employer' | 'candidate';

const COPY: Record<
  Role,
  {
    storageKey: string;
    title: string;
    badge: string;
    body: string;
    points: string[];
    cta: string;
    href: string;
  }
> = {
  employer: {
    storageKey: 'cb.employerOfferPopup',
    title: '1 month free for employers',
    badge: '1 MONTH FREE',
    body: 'Post jobs, search talent, and run your hiring pipeline at no cost for your first month.',
    points: ['Post unlimited jobs', 'Search and shortlist talent', 'No card required to start'],
    cta: 'Signup as employer',
    href: '/employer/register',
  },
  candidate: {
    storageKey: 'cb.candidateOfferPopup',
    title: 'Completely free for candidates',
    badge: 'COMPLETELY FREE',
    body: 'Build your Career Passport, practise with AI, and apply to jobs — always free for candidates.',
    points: ['Free Career Passport', 'AI practice tools', 'Apply to jobs at no cost'],
    cta: 'Signup as candidate',
    href: '/register?role=candidate',
  },
};

const runtimeSeen: Partial<Record<Role, boolean>> = {};

function readSeen(key: string) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSeen(key: string) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage may be unavailable
  }
}

export function RoleOfferPopup({ role }: { role: Role }) {
  const copy = COPY[role];
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    writeSeen(copy.storageKey);
    runtimeSeen[role] = false;
    setOpen(false);
  }, [copy.storageKey, role]);

  useEffect(() => {
    const shouldOpen = runtimeSeen[role] || (!getStoredUser()?.id && !readSeen(copy.storageKey));
    if (!shouldOpen) return;
    if (!runtimeSeen[role]) {
      runtimeSeen[role] = true;
      writeSeen(copy.storageKey);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
    setOpen(true);
  }, [copy.storageKey, role]);

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
    <div className="hl-launch-popup">
      <button
        type="button"
        className="hl-launch-popup__backdrop"
        aria-label={`Dismiss ${copy.title}`}
        onClick={close}
      />
      <div
        className={`hl-launch-popup__card wl-role-offer wl-role-offer--${role}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className="hl-launch-popup__close"
          aria-label={`Close ${copy.title}`}
          onClick={close}
        >
          <CloseIcon size={18} />
        </button>
        <div className="wl-role-offer__panel">
          <p className="wl-role-offer__badge">{copy.badge}</p>
          <h2 id={titleId} className="wl-role-offer__title">
            {copy.title}
          </h2>
          <p className="wl-role-offer__body">{copy.body}</p>
          <ul className="wl-role-offer__list">
            {copy.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Link className="hl-btn hl-btn--primary hl-btn--lg wl-role-offer__cta" href={copy.href} onClick={close}>
            {copy.cta}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
