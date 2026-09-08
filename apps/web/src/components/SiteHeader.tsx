'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { logout } from '@/lib/api';
import { getStoredUser, homePathForUser } from '@/lib/session';
import type { AuthUser } from '@careerbridge/shared';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#passport', label: 'Career Passport' },
  { href: '/#jobs', label: 'Jobs' },
  { href: '/employer/welcome', label: 'Employers' },
];

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname.startsWith('/login');
  const onRegister = pathname.startsWith('/register');
  const onAuth = onLogin || onRegister;
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const signedIn = Boolean(user?.id);
  const homeHref = homePathForUser(user);

  async function onLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      router.replace('/');
    }
  }

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-md transition ${
        onAuth
          ? 'bg-primary/95 shadow-[0_8px_30px_rgba(10,46,44,0.28)]'
          : 'bg-primary/95 shadow-[0_8px_30px_rgba(10,46,44,0.25)]'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Logo />
        {!compact ? (
          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map((item) => {
              const active = item.href !== '/#how-it-works' && pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? 'bg-accent text-primary' : 'text-white/85 hover:text-accent'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <div className="flex items-center gap-3">
          {signedIn ? (
            <>
              <Link
                href={homeHref}
                className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                My home
              </Link>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-accent"
              >
                Logout
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              {!onLogin ? (
                <Link href="/login" className="transition hover:text-accent">
                  Login
                </Link>
              ) : null}
              {!onLogin && !onRegister ? (
                <span className="text-white/45" aria-hidden="true">
                  |
                </span>
              ) : null}
              {!onRegister ? (
                <Link href="/register?role=candidate" className="transition hover:text-accent">
                  Signup
                </Link>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
