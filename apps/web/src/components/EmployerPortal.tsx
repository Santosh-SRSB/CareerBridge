'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { EmployerProfile, EmployerVerificationStatus } from '@careerbridge/shared';
import { getEmployerMe, logout } from '@/lib/api';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { EvPageHead, EvPageSkeleton, useEmployerUnreadCount } from '@/components/employer/ui';
import {
  endEmployerImpersonation,
  getEmployerImpersonation,
  getStoredUser,
} from '@/lib/session';
import '@/app/employer/employer-ui.css';

export type EmployerShellProfile = Pick<
  EmployerProfile,
  'companyName' | 'verificationStatus' | 'contactName' | 'industry' | 'city' | 'workEmail' | 'designation'
>;

const PRIMARY_NAV = [
  { href: '/employer', label: 'Dashboard', key: 'home' },
  { href: '/employer/jobs', label: 'Jobs', key: 'jobs' },
  { href: '/employer/candidates', label: 'Candidates', key: 'candidates' },
  { href: '/employer/applications', label: 'Applications', key: 'applications' },
  { href: '/employer/interviews', label: 'Interviews', key: 'interviews' },
  { href: '/notifications', label: 'Notifications', key: 'notifications' },
  { href: '/employer/reports', label: 'Analytics', key: 'analytics' },
] as const;

const ACCOUNT_NAV = [
  { href: '/employer/profile', label: 'Company Profile', key: 'profile' },
  { href: '/employer/payments', label: 'Billing', key: 'billing' },
] as const;

const NAV_GLYPH: Record<string, string> = {
  home: '▦',
  jobs: '▤',
  candidates: '☺',
  applications: '▣',
  interviews: '▥',
  analytics: '▨',
  profile: '▥',
  billing: '▭',
};

function BellGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  if (name === 'notifications') return <BellGlyph />;
  return <>{NAV_GLYPH[name] || '•'}</>;
}

function isActive(pathname: string, key: string) {
  if (key === 'home') return pathname === '/employer';
  if (key === 'jobs') {
    return (
      pathname === '/employer/jobs' ||
      (pathname.startsWith('/employer/jobs/') && !pathname.startsWith('/employer/jobs/new'))
    );
  }
  if (key === 'candidates') return pathname.startsWith('/employer/candidates');
  if (key === 'interviews') return pathname.startsWith('/employer/interviews');
  if (key === 'applications') return pathname.startsWith('/employer/applications');
  if (key === 'analytics') return pathname.startsWith('/employer/reports');
  if (key === 'notifications') return pathname.startsWith('/notifications');
  if (key === 'profile') return pathname.startsWith('/employer/profile');
  if (key === 'billing') return pathname.startsWith('/employer/payments') || pathname.startsWith('/employer/billing');
  return false;
}

function statusLabel(status?: EmployerVerificationStatus | string | null) {
  if (status === 'VERIFIED') return 'Verified';
  if (status === 'PENDING') return 'Pending';
  if (status === 'REJECTED') return 'Needs fix';
  if (status === 'KYC_COMPLETE') return 'In review';
  return 'Setup';
}

type EmployerShellContextValue = {
  profile: EmployerShellProfile;
  unreadCount: number;
  signOut: () => void;
  impersonating: boolean;
};

const EmployerShellContext = createContext<EmployerShellContextValue | null>(null);

/** Shell state (sign-out, unread count, company) for pages rendered inside the employer shell. */
export function useEmployerShell() {
  return useContext(EmployerShellContext);
}

export function TinyEagleIcon({ className = '', size = 12 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 1.2c.4 0 .9.5 1.3 1.2.5.8.8 1.7.8 2.4 0 .3-.1.5-.2.6l1.6-.4c.5-.1 1 .3 1 .8v.2c0 .3-.1.5-.3.7L10.8 8.4l1.7 1.1c.3.2.4.6.2.9l-.1.2c-.2.3-.6.4-.9.2L8.9 9.6v1.8c0 .9-.3 1.7-.8 2.3-.3.4-.7.7-1.1.7s-.8-.3-1.1-.7c-.5-.6-.8-1.4-.8-2.3V9.6L3.3 10.8c-.3.2-.7.1-.9-.2l-.1-.2c-.2-.3-.1-.7.2-.9l1.7-1.1L2.8 6.7c-.2-.2-.3-.4-.3-.7v-.2c0-.5.5-.9 1-.8l1.6.4c-.1-.1-.2-.3-.2-.6 0-.7.3-1.6.8-2.4C7.1 1.7 7.6 1.2 8 1.2Z"
      />
    </svg>
  );
}

function EmployerSidebar({
  profile,
  unreadCount,
  impersonating,
  onNavigate,
  onSignOut,
}: {
  profile: EmployerShellProfile;
  unreadCount: number;
  impersonating: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname() || '';
  const company = profile.companyName?.trim() || 'Company';

  function navLink(item: { href: string; label: string; key: string }) {
    const active = isActive(pathname, item.key);
    return (
      <Link
        key={item.key}
        href={item.href}
        className={active ? 'on' : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <i aria-hidden>
          <NavIcon name={item.key} />
        </i>
        {item.label}
        {item.key === 'notifications' && unreadCount > 0 ? (
          <span className="ev-badge" aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="ev-side" id="ev-sidebar" aria-label="Employer navigation">
      <div className="ev-brand">
        <BrandLogo href="/employer" tone="dark" size="sm" priority onClick={onNavigate} />
        <small>For employers</small>
      </div>
      {impersonating ? <p className="ev-impersonation">Admin view of this employer</p> : null}
      <div className="ev-lab">MAIN</div>
      <nav className="ev-nav" aria-label="Primary">
        {PRIMARY_NAV.map(navLink)}
      </nav>
      <div className="ev-lab">COMPANY</div>
      <nav className="ev-nav" aria-label="Company">
        {ACCOUNT_NAV.map(navLink)}
      </nav>
      <div className="ev-me">
        <b>{company}</b>
        <div className="ev-me-actions">
          <span className="ev-tag" style={{ marginLeft: 0 }}>
            {statusLabel(profile.verificationStatus)}
          </span>
          <button type="button" onClick={onSignOut}>
            {impersonating ? 'Exit to admin' : 'Sign out'}
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Static shell + skeleton while the employer profile loads. */
export function EmployerShellSkeleton() {
  return (
    <div className="ev-app">
      <header className="ev-topbar">
        <BrandLogo tone="dark" size="sm" />
      </header>
      <aside className="ev-side" aria-hidden>
        <div className="ev-brand">
          <BrandLogo tone="dark" size="sm" />
          <small>For employers</small>
        </div>
      </aside>
      <main className="ev-main">
        <EvPageSkeleton />
      </main>
    </div>
  );
}

/** @deprecated The employer shell now uses a drawer on small screens; kept for older imports. */
export function EmployerMobileNav() {
  return null;
}

export function EmployerPageHeader({
  title,
  subtitle,
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  if (!title && !subtitle && !action) return null;
  return <EvPageHead title={title || ''} subtitle={subtitle} actions={action} />;
}

function EmployerLayout({
  profile,
  children,
  onSignOut,
  bleed,
}: {
  profile: EmployerShellProfile;
  children: ReactNode;
  onSignOut: () => void;
  bleed?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const unreadCount = useEmployerUnreadCount();

  useEffect(() => {
    setImpersonating(Boolean(getEmployerImpersonation()));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function exitToAdmin() {
    if (endEmployerImpersonation()) {
      router.replace('/adminsrsb/dashboard?tab=employers');
      return;
    }
    void onSignOut();
  }

  const signOut = impersonating ? exitToAdmin : onSignOut;

  return (
    <EmployerShellContext.Provider value={{ profile, unreadCount, signOut, impersonating }}>
      <div className={`ev-app${menuOpen ? ' nav-open' : ''}`}>
        <header className="ev-topbar">
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="ev-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <BrandLogo href="/employer" tone="dark" size="sm" />
        </header>
        <div className="ev-ovl" aria-hidden onClick={() => setMenuOpen(false)} />
        <EmployerSidebar
          profile={profile}
          unreadCount={unreadCount}
          impersonating={impersonating}
          onNavigate={() => setMenuOpen(false)}
          onSignOut={signOut}
        />
        <main className="ev-main">{bleed ? children : <div className="ev-pad">{children}</div>}</main>
      </div>
    </EmployerShellContext.Provider>
  );
}

export function EmployerShell({
  profile,
  title: _title,
  bleed,
  children,
}: {
  profile: EmployerShellProfile;
  title?: string;
  /** Render children edge-to-edge (no page padding), e.g. the dashboard hero. */
  bleed?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    if (getEmployerImpersonation() && endEmployerImpersonation()) {
      router.replace('/adminsrsb/dashboard?tab=employers');
      return;
    }
    await logout();
    router.replace('/');
  }

  return (
    <EmployerLayout profile={profile} onSignOut={signOut} bleed={bleed}>
      {children}
    </EmployerLayout>
  );
}

export function EmployerShellFallback({
  title: _title,
  bleed,
  children,
}: {
  title?: string;
  bleed?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployerShellProfile>({
    companyName: 'Hiring workspace',
    verificationStatus: 'UNVERIFIED',
    contactName: null,
    industry: null,
    city: null,
    workEmail: null,
    designation: null,
  });

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.firstName) {
      setProfile((prev) => ({
        ...prev,
        companyName: stored.firstName || prev.companyName,
        contactName: stored.firstName,
      }));
    }
    getEmployerMe()
      .then((next) => {
        setProfile({
          companyName: next.companyName,
          verificationStatus: next.verificationStatus,
          contactName: next.contactName,
          industry: next.industry,
          city: next.city,
          workEmail: next.workEmail,
          designation: next.designation,
        });
      })
      .catch(() => undefined);
  }, []);

  async function signOut() {
    if (getEmployerImpersonation() && endEmployerImpersonation()) {
      router.replace('/adminsrsb/dashboard?tab=employers');
      return;
    }
    await logout();
    router.replace('/');
  }

  return (
    <EmployerLayout profile={profile} onSignOut={signOut} bleed={bleed}>
      {children}
    </EmployerLayout>
  );
}

/** @deprecated Use EmployerShellFallback — kept so older pages do not crash */
export const EmployerPortal = EmployerShellFallback;

export { statusLabel };
