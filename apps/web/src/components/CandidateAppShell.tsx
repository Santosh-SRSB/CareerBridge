'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { listApplications, logout } from '@/lib/api';
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

function iconClass(_active: boolean) {
  return 'h-4 w-4 stroke-current';
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

function DesktopNavLink({
  href,
  label,
  active,
  highlighted,
  badge,
  onClick,
  onMouseEnter,
  itemRef,
}: {
  href: string;
  label: string;
  active: boolean;
  highlighted: boolean;
  badge?: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  itemRef?: (node: HTMLAnchorElement | null) => void;
}) {
  const lit = highlighted;
  return (
    <Link
      href={href}
      ref={itemRef}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`cb-desk-nav__link relative z-[1] inline-flex h-full items-center px-5 text-base font-semibold transition-colors ${
        lit ? 'cb-desk-nav__link--on font-bold text-[#0a2e2c]' : 'text-white hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
      {typeof badge === 'number' && badge > 0 ? (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f0803c] px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

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
  mobileJobsFilterMode = false,
  onMobileJobsFilter,
}: {
  children: React.ReactNode;
  activeTab?: CandidateTab;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  maxWidth?: string;
  headerVariant?: 'default' | 'simple';
  avatarUrl?: string | null;
  /** When true on /jobs results, center Jobs tab becomes Filter. */
  mobileJobsFilterMode?: boolean;
  onMobileJobsFilter?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [initial, setInitial] = useState('C');
  const [menuOpen, setMenuOpen] = useState(false);
  const [appsCount, setAppsCount] = useState(0);
  /** Auto-swiping Resume ⇄ ATS in the mobile last slot */
  const [mobileCarousel, setMobileCarousel] = useState<'resumes' | 'ats'>('resumes');
  const [carouselTick, setCarouselTick] = useState(0);

  useEffect(() => {
    const user = getStoredUser();
    const letter = (user?.firstName || 'C').trim().charAt(0).toUpperCase() || 'C';
    setInitial(letter);
  }, []);

  useEffect(() => {
    let active = true;
    listApplications()
      .then((rows) => {
        if (active) setAppsCount(Array.isArray(rows) ? rows.length : 0);
      })
      .catch(() => {
        if (active) setAppsCount(0);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

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

  const defaultHoverKey = useMemo(() => {
    if (currentTab === 'resumes' || currentTab === 'ats') return 'carousel';
    if (DESKTOP_NAV_CORE.some((item) => item.id === currentTab)) return currentTab;
    if (currentTab === 'profile') return 'home';
    return 'home';
  }, [currentTab]);

  const [hoverKey, setHoverKey] = useState(defaultHoverKey);
  const deskNavRef = useRef<HTMLDivElement>(null);
  const deskItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    setHoverKey(defaultHoverKey);
  }, [defaultHoverKey]);

  useEffect(() => {
    const movePill = () => {
      const parent = deskNavRef.current;
      const el = deskItemRefs.current[hoverKey];
      if (!parent || !el) return;
      const parentBox = parent.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({
        left: box.left - parentBox.left,
        width: box.width,
        ready: true,
      });
    };

    movePill();
    // Recalculate after Resume/ATS label swap so white block covers the new text width
    const raf = window.requestAnimationFrame(movePill);
    window.addEventListener('resize', movePill);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', movePill);
    };
  }, [hoverKey, currentTab, carouselTick, mobileCarousel]);

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
      <header className="sticky top-0 z-40 w-full rounded-none bg-[#0a2e2c] shadow-[0_8px_24px_rgba(10,46,44,0.22)]">
        {/* Mobile: compact full-width row */}
        <div className="relative flex h-14 w-full items-center justify-between gap-3 px-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            {showBack ? (
              <button
                type="button"
                onClick={() => (onBack ? onBack() : window.history.back())}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
                aria-label="Go back"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <Link href="/dashboard" className="flex shrink-0 items-center">
              <Image
                src="/srsb-mark.png"
                alt="SRSB"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                unoptimized
                priority
              />
            </Link>
            {simpleMobileHeader ? (
              <h1 className="truncate text-base font-extrabold text-white">{title}</h1>
            ) : null}
          </div>
          <div className="relative flex items-center gap-2.5">
            <NotificationBell variant="candidate-pill" className="!h-9 !w-9" />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#f0803c] text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(240,128,60,0.35)] ring-2 ring-white/15"
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
          </div>
        </div>

        {/* Desktop: single full-width rectangle — logo | text links | utilities */}
        <div className="relative mx-auto hidden h-[84px] w-full items-center justify-between gap-6 pl-6 pr-0 md:flex lg:pl-10">
          <div className="ml-[150px] flex min-w-0 shrink-0 items-center gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={() => (onBack ? onBack() : window.history.back())}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
                aria-label="Go back"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <Link href="/dashboard" className="flex shrink-0 items-center">
              <Image
                src="/srsb-mark.png"
                alt="SRSB"
                width={80}
                height={80}
                className="h-20 w-20 object-contain"
                unoptimized
                priority
              />
            </Link>
          </div>

          <nav
            ref={deskNavRef}
            className="cb-desk-nav absolute inset-y-0 left-1/2 flex h-full -translate-x-1/2 items-stretch gap-2 lg:gap-3"
            onMouseLeave={() => setHoverKey(defaultHoverKey)}
          >
            <span
              className="cb-desk-nav__pill"
              style={{
                opacity: pill.ready ? 1 : 0,
                transform: `translateX(${pill.left}px)`,
                width: pill.width,
              }}
            />

            {DESKTOP_NAV_CORE.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <DesktopNavLink
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  active={isActive}
                  highlighted={hoverKey === item.id}
                  badge={item.id === 'applications' ? appsCount : undefined}
                  onMouseEnter={() => setHoverKey(item.id)}
                  itemRef={(node) => {
                    deskItemRefs.current[item.id] = node;
                  }}
                />
              );
            })}

            {(() => {
              const carouselActive = currentTab === 'resumes' || currentTab === 'ats';
              const carouselLit = hoverKey === 'carousel';
              const carouselLabel = mobileCarousel === 'ats' ? 'ATS' : 'View Resume';
              return (
                <Link
                  href={mobileCarouselItem.href}
                  ref={(node) => {
                    deskItemRefs.current.carousel = node;
                  }}
                  onClick={onMobileResumeAtsClick}
                  onMouseEnter={() => setHoverKey('carousel')}
                  className={`cb-desk-nav__link relative z-[1] inline-flex h-full items-center px-5 text-base font-semibold transition-colors ${
                    carouselLit
                      ? 'cb-desk-nav__link--on font-bold text-[#0a2e2c]'
                      : 'text-white hover:text-white'
                  }`}
                  aria-current={carouselActive ? 'page' : undefined}
                  aria-label={
                    mobileCarousel === 'ats' ? 'Open ATS Score' : 'Open View Resume'
                  }
                >
                  <span className="cb-desk-nav__carousel">
                    <span key={carouselTick} className="cb-desk-nav__carousel-label">
                      {carouselLabel}
                    </span>
                  </span>
                </Link>
              );
            })()}
          </nav>

          <div className="relative mr-[150px] flex shrink-0 items-center gap-3">
            <NotificationBell variant="candidate-pill" className="!h-8 !w-8" />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#f0803c] text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(240,128,60,0.35)] ring-2 ring-white/15"
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
          </div>
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-[150px] top-[84px] z-50 min-w-[160px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
              <Link
                href="/profile"
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/resumes"
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                View Resume
              </Link>
              <Link
                href="/ats"
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
      </header>

      <main className="flex-1 pb-[4.5rem] pt-4 sm:pt-6 md:pb-12 md:pt-7">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth}`}>{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 w-full border-t border-white/10 bg-[#0a2e2c] md:hidden">
        <div className="flex w-full items-end justify-between px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {mobileNavItems.map((item) => {
            const isActive = currentTab === item.id;
            const isJobsCenter = item.id === 'jobs';
            const showFilterInstead = isJobsCenter && mobileJobsFilterMode && onMobileJobsFilter;

            if (showFilterInstead) {
              return (
                <div key={item.id} className="relative flex flex-1 flex-col items-center">
                  <button
                    type="button"
                    onClick={onMobileJobsFilter}
                    className="flex w-full flex-col items-center gap-0.5 py-1 text-[10px] font-semibold text-white"
                    aria-label="Open filters"
                  >
                    <span className="flex h-10 w-10 -mt-2 items-center justify-center rounded-full bg-white text-[#0a2e2c] shadow-md">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M3 5a1 1 0 011-1h16a1 1 0 01.8 1.6L15 12.5V19a1 1 0 01-1.45.9l-3-1.5A1 1 0 0110 17.5v-5L3.2 5.6A1 1 0 013 5z" />
                      </svg>
                    </span>
                    <span className="font-bold">Filter</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={item.id} className="relative flex flex-1 flex-col items-center">
                <Link
                  href={item.href}
                  className={`flex w-full flex-col items-center gap-0.5 py-1 text-[10px] font-semibold ${
                    isActive ? 'text-white' : 'text-white/65'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full ${
                      isJobsCenter
                        ? `h-10 w-10 -mt-2 shadow-md ${isActive ? 'bg-white text-[#0a2e2c]' : 'bg-white/15 text-white ring-2 ring-white/35'}`
                        : `h-7 w-7 ${isActive ? 'bg-white text-[#0a2e2c]' : ''}`
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
                  ? 'text-white'
                  : 'text-white/65'
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    currentTab === mobileCarouselItem.id ? 'bg-white text-[#0a2e2c]' : ''
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
                  mobileCarousel === 'resumes' ? 'bg-white' : 'bg-white/35'
                }`}
              />
              <span
                className={`h-1 w-1 rounded-full ${
                  mobileCarousel === 'ats' ? 'bg-white' : 'bg-white/35'
                }`}
              />
            </span>
          </div>
        </div>
      </nav>
    </div>
  );
}
