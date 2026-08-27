'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
};

/** Order: Home → Passport → Resume → Skill assessment → Interview → Courses → Job */
const NAV: NavItem[] = [
  {
    id: 'home',
    href: '/dashboard',
    label: 'My home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'passport',
    href: '/passport?overview=1',
    label: 'Passport',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M8.5 16.5c.8-1.8 2.2-2.7 3.5-2.7s2.7.9 3.5 2.7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'resume',
    href: '/resume',
    label: 'Resume',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M16 4v4h4M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'skill',
    href: '/assessments',
    label: 'Skill assessment',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M9 12.5 10.75 14.25 15 10"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'interview',
    href: '/interviews',
    label: 'Interviews',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M16 10.5 21 8v8l-5-2.5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'courses',
    href: '/courses',
    label: 'Courses',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 6.5 12 3l7 3.5-7 3.5-7-3.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M5 10.5v5.5L12 19l7-3V10.5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'job',
    href: '/jobs',
    label: 'Jobs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path d="M9 13h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
];

const SEGMENT_COUNT = NAV.length - 1;
const PASSPORT_INDEX = 1;

function navPath(href: string) {
  return href.split('?')[0];
}

function isActive(pathname: string, href: string) {
  const path = navPath(href);
  if (path === '/dashboard') return pathname === '/dashboard';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Passport ready % maps Home → Passport; 100% fills exactly to the Passport icon. */
function progressHeightPercent(passportReady: number) {
  const safe = Math.min(100, Math.max(0, passportReady));
  return (safe / 100) * (PASSPORT_INDEX / SEGMENT_COUNT) * 100;
}

export function IconSidebar({ passportReady = 0 }: { passportReady?: number }) {
  const pathname = usePathname();
  const progress = progressHeightPercent(passportReady);
  const passportComplete = passportReady >= 100;

  return (
    <aside className="cb-icon-sidebar" aria-label="Main navigation">
      <nav className="cb-icon-sidebar__nav">
        <div className="cb-icon-sidebar__rail" aria-hidden="true">
          <span className="cb-icon-sidebar__track" />
          <span
            className={`cb-icon-sidebar__progress${passportComplete ? ' is-complete' : ''}`}
            style={{ ['--cb-sidebar-progress' as string]: `${progress}%` }}
          />
          <span className="cb-icon-sidebar__sweep" />
        </div>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const isJob = item.id === 'job';
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`cb-icon-sidebar__item${active ? ' is-active' : ''}${isJob ? ' is-job' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="cb-icon-sidebar__icon">{item.icon}</span>
              <span className="cb-icon-sidebar__flyout" aria-hidden>
                {item.label}
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
