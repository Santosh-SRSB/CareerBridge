'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

type DashNavId = 'home' | 'profile' | 'jobs' | 'applications' | 'interviews' | 'ats';

type DashNavItem = {
  id: DashNavId;
  label: string;
  href: string;
};

const TOP_NAV: DashNavItem[] = [
  { id: 'home', label: 'Dashboard', href: '/dashboard' },
  { id: 'profile', label: 'My Profile', href: '/profile' },
  { id: 'jobs', label: 'Job Listings', href: '/jobs' },
  { id: 'applications', label: 'Applications', href: '/applications' },
  { id: 'interviews', label: 'Interviews', href: '/interviews' },
  { id: 'ats', label: 'ATS Checker', href: '/ats' },
];

function resolveActive(pathname: string): DashNavId {
  if (pathname.startsWith('/jobs')) return 'jobs';
  if (pathname.startsWith('/applications')) return 'applications';
  if (pathname.startsWith('/interviews')) return 'interviews';
  if (pathname.startsWith('/ats') || pathname.startsWith('/resumes')) return 'ats';
  if (pathname.startsWith('/profile') || pathname.startsWith('/passport')) return 'profile';
  return 'home';
}

export function CandidateDashboardShell({
  children,
  avatarUrl,
}: {
  children: React.ReactNode;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [initial, setInitial] = useState('C');
  const [menuOpen, setMenuOpen] = useState(false);
  const active = resolveActive(pathname);

  useEffect(() => {
    const user = getStoredUser();
    setInitial((user?.firstName || 'C').trim().charAt(0).toUpperCase() || 'C');
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  }

  return (
    <div className="cb-candash-shell min-h-screen bg-[#f4f6f8] text-[#111827]">
      <header className="sticky top-0 z-50 bg-[#111827]">
        <nav className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:h-[68px] sm:px-6 lg:px-8">
          <Link href="/dashboard" className="shrink-0 text-[1.35rem] font-extrabold tracking-tight text-white sm:text-[1.5rem]">
            SRSB<span className="text-[#3b82f6]">.</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex lg:gap-1.5">
            {TOP_NAV.map((item) => {
              const isActive = active === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition lg:px-3.5 ${
                    isActive
                      ? 'bg-[#f59e0b] text-[#111827]'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#3b82f6] text-sm font-bold text-white"
              aria-label="Open profile"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="hidden rounded-lg border border-white/25 bg-[#1f2937] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#374151] sm:inline-flex"
            >
              Sign out
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 text-white transition hover:bg-white/10 md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span className="flex flex-col gap-1.5">
                <span className={`h-0.5 w-4 bg-current transition ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
                <span className={`h-0.5 w-4 bg-current transition ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 w-4 bg-current transition ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
              </span>
            </button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="border-t border-white/10 px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
              {TOP_NAV.map((item) => {
                const isActive = active === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`rounded-lg px-3.5 py-2.5 text-sm font-semibold ${
                      isActive ? 'bg-[#f59e0b] text-[#111827]' : 'text-white hover:bg-white/10'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void onLogout()}
                className="mt-1 rounded-lg border border-white/25 px-3.5 py-2.5 text-left text-sm font-semibold text-white sm:hidden"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
