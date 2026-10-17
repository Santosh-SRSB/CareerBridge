'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PassportPreview } from '@/components/PassportPreview';
import { HoverTilt } from '@/components/HoverTilt';
import { BackButton } from '@/components/ui/BackButton';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

const NAV = [
  { href: '/dashboard', label: 'My home' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/passport?overview=1', label: 'Passport' },
  { href: '/resume', label: 'Resume' },
  { href: '/interviews', label: 'Interviews' },
];

function navPath(href: string) {
  return href.split('?')[0];
}

function isActive(pathname: string, href: string) {
  const path = navPath(href);
  if (path === '/dashboard') return pathname === '/dashboard';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function prettyText(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function CandidateTopBar({
  name,
  onSignOut,
}: {
  name: string;
  onSignOut: () => void;
}) {
  const displayName = prettyText(name);

  return (
    <header className="sticky top-0 z-40 border-b border-primary/8 bg-white/80 shadow-[0_10px_30px_rgba(12,51,64,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-2 md:grid md:grid-cols-[auto_minmax(220px,520px)_1fr] lg:px-4">
        <BackButton fallback="/dashboard" />
        <form action="/jobs" method="get" className="hidden w-full md:block">
          <div className="flex w-full overflow-hidden rounded-pill border border-primary/10 bg-[#f7fbfb] shadow-[0_8px_20px_rgba(12,51,64,0.06)]">
            <input
              name="q"
              type="search"
              placeholder="Search jobs by title or skill"
              className="min-w-0 flex-1 bg-transparent px-5 py-2.5 text-sm text-primary outline-none"
            />
            <button
              type="submit"
              className="m-1 shrink-0 rounded-pill bg-teal px-5 text-sm font-bold text-primary transition hover:brightness-105"
            >
              Search
            </button>
          </div>
        </form>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <p className="truncate text-sm font-bold text-primary">{displayName}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-8 shrink-0 items-center rounded-full bg-[#1ec8c0] px-3.5 text-xs font-extrabold text-[#0c3340] transition hover:brightness-110"
          >
            Sign out
          </button>
        </div>
      </div>
      <form action="/jobs" method="get" className="px-3 pb-2 md:hidden">
        <div className="flex overflow-hidden rounded-pill border border-primary/15 bg-[#f7fbfb]">
          <input
            name="q"
            type="search"
            placeholder="Search jobs"
            className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-primary outline-none"
          />
          <button type="submit" className="m-1 shrink-0 rounded-pill bg-teal px-4 text-sm font-bold text-primary">
            Search
          </button>
        </div>
      </form>
    </header>
  );
}

export function ProfileRail({
  name,
  city,
  percentage,
  skills = [],
  resumeScore,
  interviewScore,
  passportId,
  photoUrl,
  showNav = true,
}: {
  name: string;
  city: string;
  percentage: number;
  skills?: string[];
  resumeScore?: number | null;
  interviewScore?: number | null;
  passportId?: string;
  photoUrl?: string | null;
  showNav?: boolean;
}) {
  const displayName = prettyText(name);
  const displayCity = prettyText(city || 'India');

  return (
    <aside className="space-y-4">
      <HoverTilt>
        <PassportPreview
          name={displayName}
          location={displayCity}
          ready={percentage}
          skills={skills}
          photoUrl={photoUrl}
          resumeScore={resumeScore}
          interviewScore={interviewScore}
          passportId={passportId}
        />
      </HoverTilt>

      {showNav ? (
        <nav className="cb-dash-card hidden p-2 lg:block" aria-label="Candidate">
          <PortalNav />
        </nav>
      ) : null}
    </aside>
  );
}

function PortalNav() {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-[#0c3340] text-white' : 'text-muted hover:bg-[#f7fbfb] hover:text-primary'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function CandidateShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [name, setName] = useState('there');

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.firstName) setName(stored.firstName);
  }, []);

  async function signOut() {
    await logout();
    router.replace('/');
  }

  return (
    <div className="cb-portal-page">
      <CandidateTopBar name={name} onSignOut={signOut} />
      <div className="cb-portal-wrap grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="cb-dash-card hidden p-2 lg:block" aria-label="Candidate">
          <PortalNav />
        </nav>
        <div className="min-w-0 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
