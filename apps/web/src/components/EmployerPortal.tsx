'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { EmployerProfile, EmployerVerificationStatus } from '@careerbridge/shared';
import { BackButton } from '@/components/ui/BackButton';
import { getEmployerMe, logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

const NAV = [
  { href: '/employer', label: 'Home', icon: '⌂' },
  { href: '/employer/jobs', label: 'Jobs', icon: '▣' },
  { href: '/employer/applications', label: 'Applications', icon: '▤' },
  { href: '/employer/profile', label: 'Company', icon: '◈' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/employer') return pathname === '/employer';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function verificationLabel(status: EmployerVerificationStatus | string) {
  if (status === 'VERIFIED') return 'Verified';
  if (status === 'PENDING') return 'Pending review';
  if (status === 'KYC_COMPLETE') return 'Complete affiliation';
  if (status === 'REJECTED') return 'Needs attention';
  return 'Setup required';
}

function verificationClass(status: EmployerVerificationStatus | string) {
  if (status === 'VERIFIED') return 'border-teal/40 bg-teal/15 text-primary';
  if (status === 'PENDING') return 'border-accent/50 bg-accent-soft text-primary';
  if (status === 'REJECTED') return 'border-error/40 bg-error/10 text-error';
  return 'border-white/35 bg-white/10 text-white';
}

export function EmployerTopBar({
  companyName,
  verificationStatus,
  onSignOut,
}: {
  companyName: string;
  verificationStatus?: EmployerVerificationStatus | string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="site-navbar sticky top-0 z-50">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:h-[84px] sm:gap-4 sm:px-10">
        <BackButton fallback="/employer" light />

        <Link href="/employer" className="logo-mark shrink-0" aria-label="SRSB home">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-9 w-auto bg-transparent sm:h-10"
            unoptimized
            priority
          />
        </Link>

        <div className="cb-employer-identity hidden min-w-0 sm:flex">
          <span className="cb-employer-identity__divider" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">
              Employer
            </p>
            <p className="truncate text-sm font-semibold text-white sm:text-base">{companyName}</p>
            {verificationStatus ? (
              <span
                className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${verificationClass(
                  verificationStatus,
                )}`}
              >
                {verificationLabel(verificationStatus)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 sm:hidden">
          <p className="truncate text-sm font-semibold text-white/90">{companyName}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/employer/jobs/new"
            className="hidden rounded-full bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-4 py-2.5 text-sm font-bold text-navy transition hover:brightness-110 sm:inline-flex"
          >
            Create job
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 items-center rounded-full border-[1.5px] border-white/55 px-4 text-sm font-semibold text-white transition hover:bg-white/10 sm:px-5"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function EmployerSideNav() {
  const pathname = usePathname();
  return (
    <nav className="cb-side-nav hidden p-2.5 lg:block" aria-label="Recruiter">
      <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
        Workspace
      </p>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`cb-nav-link mb-1 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold ${
              active
                ? 'bg-gradient-to-r from-[#0a2e2c] to-[#134e4a] text-white shadow-[0_10px_24px_rgba(10,46,44,0.22)]'
                : 'text-muted hover:bg-fog hover:text-navy'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${
                active ? 'bg-white/12' : 'bg-fog'
              }`}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function EmployerMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/10 bg-surface/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-pill px-2 py-2.5 text-center text-[12px] font-bold ${
                active ? 'bg-accent text-primary' : 'text-muted hover:text-primary'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function EmployerShell({
  profile,
  children,
}: {
  profile: Pick<EmployerProfile, 'companyName' | 'verificationStatus'>;
  children: ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    await logout();
    router.replace('/');
  }

  return (
    <div className="cb-portal-page pb-24 lg:pb-0">
      <EmployerTopBar
        companyName={profile.companyName}
        verificationStatus={profile.verificationStatus}
        onSignOut={signOut}
      />
      <div className="cb-portal-wrap grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <EmployerSideNav />
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
      <EmployerMobileNav />
    </div>
  );
}

export function EmployerShellFallback({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Hiring workspace');
  const [verificationStatus, setVerificationStatus] = useState<EmployerVerificationStatus | string | null>(
    null,
  );

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.firstName) {
      setCompanyName(stored.firstName);
    }

    getEmployerMe()
      .then((profile) => {
        if (profile.companyName?.trim()) {
          setCompanyName(profile.companyName.trim());
        }
        setVerificationStatus(profile.verificationStatus);
      })
      .catch(() => undefined);
  }, []);

  async function signOut() {
    await logout();
    router.replace('/');
  }

  return (
    <div className="cb-portal-page pb-24 lg:pb-0">
      <EmployerTopBar
        companyName={companyName}
        verificationStatus={verificationStatus}
        onSignOut={signOut}
      />
      <div className="cb-portal-wrap grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <EmployerSideNav />
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
      <EmployerMobileNav />
    </div>
  );
}
