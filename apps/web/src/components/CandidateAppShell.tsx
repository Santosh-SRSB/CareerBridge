'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { NotificationBell } from '@/components/NotificationBell';

export type CandidateTab =
  | 'home'
  | 'jobs'
  | 'applications'
  | 'interviews'
  | 'profile'
  | 'resumes'
  | 'ats';

type NavItem = {
  id: CandidateTab;
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
};

const MOBILE_SWITCH_KEY = 'cb.mobileLastResumeTab';

function iconClass(active: boolean) {
  return `h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`;
}

const NAV_HOME: NavItem = {
  id: 'home',
  label: 'Home',
  href: '/dashboard',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5l9-7 9 7V20a1.5 1.5 0 01-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 013 20V10.5z"
      />
    </svg>
  ),
};

const NAV_JOBS: NavItem = {
  id: 'jobs',
  label: 'Jobs',
  href: '/jobs',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
    </svg>
  ),
};

const NAV_APPLICATIONS: NavItem = {
  id: 'applications',
  label: 'Applications',
  href: '/applications',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
    </svg>
  ),
};

const NAV_INTERVIEWS: NavItem = {
  id: 'interviews',
  label: 'Interviews',
  href: '/interviews',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      {/* Microphone — interview */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10v1a7 7 0 01-14 0v-1M12 18v3M8 21h8"
      />
    </svg>
  ),
};

const NAV_RESUMES: NavItem = {
  id: 'resumes',
  label: 'Resumes',
  href: '/resumes',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ),
};

const NAV_ATS: NavItem = {
  id: 'ats',
  label: 'ATS',
  href: '/ats',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      {/* Document + check — ATS readiness */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3h6l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 13.5l1.8 1.8 3.4-3.8" />
    </svg>
  ),
};

const NAV_PROFILE: NavItem = {
  id: 'profile',
  label: 'Profile',
  href: '/profile',
  icon: (active) => (
    <svg className={iconClass(active)} fill="none" viewBox="0 0 24 24" strokeWidth="1.85" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
};

/** Desktop: modules except Resume/ATS (those share one auto-swipe slot). */
export const CANDIDATE_NAV_ITEMS: NavItem[] = [
  NAV_HOME,
  NAV_JOBS,
  NAV_APPLICATIONS,
  NAV_INTERVIEWS,
  NAV_RESUMES,
  NAV_ATS,
  NAV_PROFILE,
];

const DESKTOP_NAV_CORE: NavItem[] = [
  NAV_HOME,
  NAV_JOBS,
  NAV_APPLICATIONS,
  NAV_INTERVIEWS,
];

function resolveTab(pathname: string, activeTab?: CandidateTab): CandidateTab {
  if (activeTab) return activeTab;
  if (pathname.startsWith('/jobs')) return 'jobs';
  if (pathname.startsWith('/applications')) return 'applications';
  if (pathname.startsWith('/interviews')) return 'interviews';
  if (pathname.startsWith('/resumes')) return 'resumes';
  if (pathname.startsWith('/ats')) return 'ats';
  if (pathname.startsWith('/passport') || pathname.startsWith('/profile')) return 'profile';
  return 'home';
}

export function CandidateAppShell({
  children,
  activeTab,
  title,
  showBack = false,
  onBack,
  maxWidth = 'max-w-6xl',
  headerVariant = 'default',
  avatarUrl,
}: {
  children: React.ReactNode;
  activeTab?: CandidateTab;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  maxWidth?: string;
  headerVariant?: 'default' | 'simple';
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [initial, setInitial] = useState('C');
  const [menuOpen, setMenuOpen] = useState(false);
  /** Auto-swiping Resume ⇄ ATS in the mobile last slot */
  const [mobileCarousel, setMobileCarousel] = useState<'resumes' | 'ats'>('resumes');
  const [carouselTick, setCarouselTick] = useState(0);

  useEffect(() => {
    const user = getStoredUser();
    const letter = (user?.firstName || 'C').trim().charAt(0).toUpperCase() || 'C';
    setInitial(letter);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(MOBILE_SWITCH_KEY);
    if (stored === 'ats' || stored === 'resumes') setMobileCarousel(stored);
  }, []);

  /** Automatic swipe: Resume → ATS → Resume … every ~2.8s */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const id = window.setInterval(() => {
      setMobileCarousel((prev) => {
        const next = prev === 'resumes' ? 'ats' : 'resumes';
        window.localStorage.setItem(MOBILE_SWITCH_KEY, next);
        return next;
      });
      setCarouselTick((t) => t + 1);
    }, 2800);

    return () => window.clearInterval(id);
  }, []);

  const currentTab = resolveTab(pathname, activeTab);
  const simpleMobileHeader = headerVariant === 'simple' && Boolean(title);

  const mobileCarouselItem =
    mobileCarousel === 'ats' ? NAV_ATS : { ...NAV_RESUMES, label: 'Resume' };

  /** Mobile: Home · Apps · Jobs (center) · Interviews · auto-swiping Resume/ATS */
  const mobileNavItems = useMemo(
    () => [
      NAV_HOME,
      { ...NAV_APPLICATIONS, label: 'Apps' },
      NAV_JOBS,
      { ...NAV_INTERVIEWS, label: 'Interview' },
    ],
    [],
  );

  function onMobileResumeAtsClick() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOBILE_SWITCH_KEY, mobileCarousel);
    }
  }

  async function onLogout() {
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8f7] font-sans text-[#0a2e2c]">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={() => (onBack ? onBack() : window.history.back())}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Go back"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image
                src="/srsb-mark.png"
                alt="CareerBridge"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain"
                unoptimized
                priority
              />
              <span className="hidden text-[15px] font-black tracking-tight text-[#0a2e2c] sm:inline">
                CareerBridge
              </span>
            </Link>
            {simpleMobileHeader ? (
              <h1 className="truncate text-base font-extrabold text-slate-900 md:hidden">{title}</h1>
            ) : null}
          </div>

          <nav className="absolute left-1/2 top-1/2 hidden max-w-[min(100%,760px)] -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 overflow-hidden md:flex">
            {DESKTOP_NAV_CORE.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold transition lg:gap-2 lg:px-3.5 lg:text-sm ${
                    isActive
                      ? 'bg-[#0a2e2c] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-[#0a2e2c]'
                  }`}
                >
                  {item.icon(isActive)}
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Desktop: auto-swiping View Resume ⇄ ATS Checker */}
            <Link
              href={mobileCarouselItem.href}
              onClick={onMobileResumeAtsClick}
              className={`relative flex h-9 min-w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full px-3 text-xs font-semibold transition lg:min-w-[9rem] lg:px-3.5 lg:text-sm ${
                currentTab === 'resumes' || currentTab === 'ats'
                  ? 'bg-[#0a2e2c] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-[#0a2e2c]'
              }`}
              aria-label={
                mobileCarousel === 'ats' ? 'Open ATS Checker' : 'Open View Resume'
              }
            >
              <span key={`desk-${carouselTick}`} className="cb-nav-swipe flex flex-row items-center gap-1.5">
                {mobileCarouselItem.icon(currentTab === 'resumes' || currentTab === 'ats')}
                <span>
                  {mobileCarousel === 'ats' ? 'ATS Checker' : 'View Resume'}
                </span>
              </span>
            </Link>

            <Link
              href={NAV_PROFILE.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold transition lg:gap-2 lg:px-3.5 lg:text-sm ${
                currentTab === 'profile'
                  ? 'bg-[#0a2e2c] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-[#0a2e2c]'
              }`}
            >
              {NAV_PROFILE.icon(currentTab === 'profile')}
              <span>{NAV_PROFILE.label}</span>
            </Link>
          </nav>

          <div className="relative flex items-center gap-2">
            <NotificationBell />

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#d7e4e0] bg-[#0a2e2c] text-sm font-bold text-white"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 min-w-[160px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <Link
                    href="/profile"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/resumes"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    View Resume
                  </Link>
                  <Link
                    href="/ats"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    ATS Score
                  </Link>
                  <Link
                    href="/notifications"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Notifications
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 pt-5 sm:pt-7 md:pb-12">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth}`}>{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-end justify-around px-1 py-1.5">
          {mobileNavItems.map((item) => {
            const isActive = currentTab === item.id;
            const isJobsCenter = item.id === 'jobs';
            return (
              <div key={item.id} className="relative flex flex-1 flex-col items-center">
                <Link
                  href={item.href}
                  className={`flex w-full flex-col items-center gap-0.5 py-1 text-[10px] font-semibold ${
                    isActive ? 'text-[#0a2e2c]' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full ${
                      isJobsCenter
                        ? `h-11 w-11 -mt-3 shadow-md ${isActive ? 'bg-[#0a2e2c] text-white' : 'bg-white text-[#0a2e2c] ring-2 ring-slate-200'}`
                        : `h-8 w-8 ${isActive ? 'bg-[#0a2e2c] text-white' : ''}`
                    }`}
                  >
                    {item.icon(isActive)}
                  </span>
                  <span className={isJobsCenter ? 'font-bold' : ''}>{item.label}</span>
                </Link>
              </div>
            );
          })}

          {/* Auto-swiping Resume ⇄ ATS */}
          <div className="relative flex flex-1 flex-col items-center overflow-hidden">
            <Link
              href={mobileCarouselItem.href}
              onClick={onMobileResumeAtsClick}
              className={`flex w-full flex-col items-center py-1 text-[10px] font-semibold ${
                currentTab === 'resumes' || currentTab === 'ats'
                  ? 'text-[#0a2e2c]'
                  : 'text-slate-400'
              }`}
              aria-label={
                mobileCarousel === 'ats' ? 'Open ATS Score' : 'Open View Resume'
              }
            >
              <span
                key={carouselTick}
                className="cb-nav-swipe flex flex-col items-center gap-0.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    currentTab === mobileCarouselItem.id ? 'bg-[#0a2e2c] text-white' : ''
                  }`}
                >
                  {mobileCarouselItem.icon(currentTab === mobileCarouselItem.id)}
                </span>
                <span>{mobileCarouselItem.label}</span>
              </span>
            </Link>
            <span className="mt-0.5 flex gap-1" aria-hidden>
              <span
                className={`h-1 w-1 rounded-full ${
                  mobileCarousel === 'resumes' ? 'bg-[#e68a39]' : 'bg-slate-300'
                }`}
              />
              <span
                className={`h-1 w-1 rounded-full ${
                  mobileCarousel === 'ats' ? 'bg-[#e68a39]' : 'bg-slate-300'
                }`}
              />
            </span>
          </div>
        </div>
      </nav>
    </div>
  );
}
