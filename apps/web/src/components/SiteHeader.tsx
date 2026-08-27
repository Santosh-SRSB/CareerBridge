'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getStoredUser } from '@/lib/session';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#passport', label: 'Career Passport' },
  { href: '/#jobs', label: 'Jobs' },
  { href: '/register?role=employer', label: 'Employers' },
];

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const onLogin = pathname.startsWith('/login');
  const onRegister = pathname.startsWith('/register');
  const onAuth = onLogin || onRegister;
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getStoredUser()?.id));
  }, []);

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
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              My home
            </Link>
          ) : (
            <>
              {!onLogin ? (
                <Link
                  href="/login"
                  className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Sign In
                </Link>
              ) : null}
              {!onRegister ? (
                <Link
                  href="/register?role=candidate"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-accent"
                >
                  Create Free Passport
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
