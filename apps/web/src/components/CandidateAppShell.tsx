'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { NotificationBell } from '@/components/NotificationBell';

export type CandidateTab = 'home' | 'jobs' | 'applications' | 'interviews' | 'profile';

export const CANDIDATE_NAV_ITEMS: Array<{
  id: CandidateTab;
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}> = [
  {
    id: 'home',
    label: 'Home',
    href: '/dashboard',
    icon: (active) => (
      <svg
        className={`h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'jobs',
    label: 'Jobs',
    href: '/jobs',
    icon: (active) => (
      <svg
        className={`h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'applications',
    label: 'Applications',
    href: '/applications',
    icon: (active) => (
      <svg
        className={`h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'interviews',
    label: 'Interviews',
    href: '/interviews',
    icon: (active) => (
      <svg
        className={`h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: (active) => (
      <svg
        className={`h-[18px] w-[18px] ${active ? 'stroke-white' : 'stroke-current'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

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

  useEffect(() => {
    const user = getStoredUser();
    const letter = (user?.firstName || 'C').trim().charAt(0).toUpperCase() || 'C';
    setInitial(letter);
  }, []);

  const currentTab =
    activeTab ||
    (pathname.startsWith('/jobs')
      ? 'jobs'
      : pathname.startsWith('/applications')
        ? 'applications'
        : pathname.startsWith('/interviews')
          ? 'interviews'
          : pathname.startsWith('/passport') || pathname.startsWith('/profile')
            ? 'profile'
            : 'home');

  const simpleMobileHeader = headerVariant === 'simple' && Boolean(title);

  async function onLogout() {
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[#0a2e2c] font-sans flex flex-col">
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

          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
            {CANDIDATE_NAV_ITEMS.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
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

      <main className="flex-1 pb-24 md:pb-12 pt-5 sm:pt-7">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth}`}>{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {CANDIDATE_NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-semibold ${
                  isActive ? 'text-[#0a2e2c]' : 'text-slate-400'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isActive ? 'bg-[#0a2e2c] text-white' : ''
                  }`}
                >
                  {item.icon(isActive)}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
