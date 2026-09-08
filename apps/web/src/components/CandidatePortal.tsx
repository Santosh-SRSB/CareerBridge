'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PassportPreview } from '@/components/PassportPreview';
import { HoverTilt } from '@/components/HoverTilt';
import { BackButton } from '@/components/ui/BackButton';
import { ActiveInterviewTimerBanner } from '@/components/ActiveInterviewTimerBanner';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

const NAV = [
  { href: '/dashboard', label: 'My home' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/passport?overview=1', label: 'Passport' },
  { href: '/courses', label: 'Courses' },
  { href: '/interviews', label: 'Interviews' },
  { href: '/assessments', label: 'Skill assessment' },
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
    <header className="site-navbar sticky top-0 z-50">
      <ActiveInterviewTimerBanner compact />
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:h-[84px] sm:px-10">
        <BackButton fallback="/dashboard" light />
        <Link href="/dashboard" className="logo-mark hidden shrink-0 sm:inline-flex">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-10 w-auto bg-transparent sm:h-11"
            unoptimized
            priority
          />
        </Link>
        <div className="min-w-0 flex-1" />

        <div className="ml-auto flex min-w-0 items-center justify-end gap-3">
          <p className="truncate text-sm font-semibold text-white/90">{displayName}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 shrink-0 items-center rounded-full border-[1.5px] border-white/55 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </div>
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
    <div className="cb-profile-rail">
      {showNav ? (
        <nav className="cb-dash-card cb-profile-rail__nav hidden p-2 lg:block" aria-label="Candidate">
          <PortalNav />
        </nav>
      ) : null}

      <HoverTilt className="cb-profile-rail__passport">
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
    </div>
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
              active ? 'bg-navy text-white' : 'text-muted hover:bg-fog hover:text-navy'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function CandidateShell({
  children,
  studio = false,
  scene,
}: {
  children: ReactNode;
  studio?: boolean;
  scene?: 'drop' | 'rules' | 'type' | 'cam' | 'result' | 'ok';
}) {
  const router = useRouter();
  const [name, setName] = useState('there');

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.firstName) setName(stored.firstName);
  }, []);

  async function signOut() {
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  }

  const cinema = scene === 'ok' || scene === 'cam';

  return (
    <div className={`cb-portal-page ${studio ? `cb-check-page${scene ? ` is-${scene}` : ''}` : ''}`}>
      <CandidateTopBar name={name} onSignOut={signOut} />
      <div
        className={
          cinema
            ? 'cb-portal-wrap'
            : 'cb-portal-wrap grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]'
        }
      >
        {cinema ? null : (
          <nav className="cb-dash-card hidden p-2 lg:block" aria-label="Candidate">
            <PortalNav />
          </nav>
        )}
        <div className="min-w-0 space-y-3">{children}</div>
      </div>
    </div>
  );
}
