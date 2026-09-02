'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@careerbridge/shared';
import { getStoredUser } from '@/lib/session';
import { logout } from '@/lib/api';

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
        className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
        fill="none"
        viewBox="0 0 24 24"
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
        className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
        fill="none"
        viewBox="0 0 24 24"
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
        className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
        fill="none"
        viewBox="0 0 24 24"
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
        className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
        fill="none"
        viewBox="0 0 24 24"
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
        className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
        fill="none"
        viewBox="0 0 24 24"
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
}: {
  children: React.ReactNode;
  activeTab?: CandidateTab;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  maxWidth?: string;
  headerVariant?: 'default' | 'simple';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
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

  const fullName = user?.firstName || 'Candidate';
  const initials = (user?.firstName || 'CB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const simpleMobileHeader = headerVariant === 'simple' && Boolean(title);

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#0a2e2c] font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {simpleMobileHeader ? (
            <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
              {showBack ? (
                <button
                  type="button"
                  onClick={() => (onBack ? onBack() : window.history.back())}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  aria-label="Go back"
                >
                  <svg className="h-4 w-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              ) : null}
              <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">{title}</h1>
            </div>
          ) : null}

          <div className={`flex items-center gap-4 ${simpleMobileHeader ? 'hidden md:flex' : ''}`}>
            {showBack && !simpleMobileHeader ? (
              <button
                type="button"
                onClick={() => (onBack ? onBack() : window.history.back())}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                aria-label="Go back"
              >
                <svg className="h-4 w-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : showBack && simpleMobileHeader ? (
              <button
                type="button"
                onClick={() => (onBack ? onBack() : window.history.back())}
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                aria-label="Go back"
              >
                <svg className="h-4 w-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}

            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0a2e2c] text-xs font-black text-white shadow-sm">
                CB
              </span>
              <span className="text-base font-black tracking-tight text-[#0a2e2c]">Career Bridge</span>
            </Link>

            {title ? (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 text-sm font-bold text-slate-700">
                {title}
              </div>
            ) : null}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {CANDIDATE_NAV_ITEMS.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-[#0a2e2c] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#0a2e2c]'
                  }`}
                >
                  <span className={isActive ? '[&>svg]:stroke-white' : ''}>
                    {item.icon(isActive)}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className={`flex items-center gap-3 ${simpleMobileHeader ? 'hidden md:flex' : ''}`}>
            <Link
              href="/profile"
              className="flex items-center gap-2.5 rounded-full p-1 sm:pr-3 sm:hover:bg-slate-100 transition"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a2e2c] text-xs font-bold text-white shadow-sm">
                {initials || 'CB'}
              </div>
              <span className="hidden sm:inline-block text-xs font-bold text-slate-800">
                {fullName}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:inline-flex items-center justify-center h-9 px-3.5 text-xs font-bold text-slate-500 hover:text-error hover:bg-error/5 rounded-xl transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-12 pt-4 sm:pt-6">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on md and up) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg">
        <div className="mx-auto flex max-w-md items-center justify-around py-2 px-2 sm:px-4">
          {CANDIDATE_NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-all ${
                  isActive ? 'text-[#0a2e2c] font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.icon(isActive)}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
