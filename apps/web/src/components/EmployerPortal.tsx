'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { EmployerProfile, EmployerVerificationStatus } from '@careerbridge/shared';
import { getEmployerMe, logout } from '@/lib/api';
import {
  endEmployerImpersonation,
  getEmployerImpersonation,
  getStoredUser,
} from '@/lib/session';

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

function NavIcon({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4.5 10.5 12 4.5l7.5 6v9a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19.5v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.5 20.5v-6.5h5v6.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'jobs') {
    return (
      <svg {...common}>
        <rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (name === 'candidates') {
    return (
      <svg {...common}>
        <circle cx="9.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 18.5c.8-2.8 2.6-4 4.5-4s3.7 1.2 4.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'interviews') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'applications') {
    return (
      <svg {...common}>
        <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-3-1.5-3 1.5-3-1.5-3 1.5V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 9h6M9 12.5h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'notifications') {
    return (
      <svg {...common}>
        <path
          d="M12 3.5a5 5 0 0 1 5 5v2.2c0 .9.3 1.8.9 2.5l1.1 1.3c.7.8.1 2.1-1 2.1H6c-1.1 0-1.7-1.3-1-2.1l1.1-1.3c.6-.7.9-1.6.9-2.5V8.5a5 5 0 0 1 5-5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'analytics') {
    return (
      <svg {...common}>
        <path d="M5 19.5V10M12 19.5V5M19 19.5v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'profile') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6 19.5c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'billing') {
    return (
      <svg {...common}>
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 14h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
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
  if (key === 'billing') return pathname.startsWith('/employer/payments');
  return false;
}

function statusLabel(status?: EmployerVerificationStatus | string | null) {
  if (status === 'VERIFIED') return 'Verified';
  if (status === 'PENDING') return 'Pending';
  if (status === 'REJECTED') return 'Needs fix';
  if (status === 'KYC_COMPLETE') return 'In review';
  return 'Setup';
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

function EmployerDeskBar({
  profile,
  onSignOut,
  menuOpen,
  setMenuOpen,
}: {
  profile: EmployerShellProfile;
  onSignOut: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const company = profile.companyName?.trim() || 'Company';
  const displayName = profile.contactName?.trim() || company;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <header className="ep-deskbar ep-deskbar--leftnav">
      <div className="ep-deskbar__top">
        <div className="ep-deskbar__brand-row">
          <button
            type="button"
            className="ep-deskbar__menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <div className="ep-deskbar__right">
            <div className="ep-deskbar__user" ref={menuRef}>
              <button
                type="button"
                className="ep-deskbar__profile-btn"
                aria-expanded={menu}
                aria-haspopup="menu"
                onClick={() => setMenu((v) => !v)}
              >
                <span className="ep-deskbar__who">
                  <span className="ep-deskbar__who-label">Signed in</span>
                  <strong className="ep-deskbar__who-name">{company}</strong>
                </span>
                <span className="ep-deskbar__avatar">{displayName.slice(0, 1).toUpperCase()}</span>
              </button>
              {menu ? (
                <div className="ep-deskbar__dropdown" role="menu">
                  <Link href="/employer/profile" role="menuitem" onClick={() => setMenu(false)}>
                    Company profile
                  </Link>
                  <Link href="/employer/reports" role="menuitem" onClick={() => setMenu(false)}>
                    Analytics
                  </Link>
                  <button type="button" role="menuitem" onClick={onSignOut}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <nav className="ep-deskbar__drawer" aria-label="Mobile menu">
          {[...PRIMARY_NAV, ...ACCOUNT_NAV].map((item) => (
            <Link
              key={`${item.key}-${item.label}`}
              href={item.href}
              className={`ep-deskbar__drawer-link ${isActive(pathname, item.key) ? 'is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <button type="button" className="ep-deskbar__drawer-logout" onClick={onSignOut}>
            Sign out
          </button>
        </nav>
      ) : null}
    </header>
  );
}

function EmployerRightNav({
  profile,
  onSignOut,
}: {
  profile: EmployerShellProfile;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const company = profile.companyName?.trim() || 'Company';

  return (
    <aside className="ep-aside ep-aside--left" aria-label="Employer navigation">
      <Link href="/employer" className="ep-aside__brand">
        <Image
          src="/srsb-mark.png"
          alt="SRSB"
          width={72}
          height={72}
          className="ep-aside__brand-logo"
          unoptimized
        />
        <span className="ep-aside__brand-text">
          <strong>CareerBridge</strong>
          <em>Employer</em>
        </span>
      </Link>

      <nav className="ep-aside__nav" aria-label="Primary">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`ep-aside__link ${isActive(pathname, item.key) ? 'is-active' : ''}`}
          >
            <span className="ep-aside__ico">
              <NavIcon name={item.key} />
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="ep-aside__foot">
        <p className="ep-aside__group">Account</p>
        <nav className="ep-aside__nav ep-aside__nav--account" aria-label="Account">
          {ACCOUNT_NAV.map((item) => (
            <Link
              key={`${item.key}-${item.label}`}
              href={item.href}
              className={`ep-aside__link ${isActive(pathname, item.key) ? 'is-active' : ''}`}
            >
              <span className="ep-aside__ico">
                <NavIcon name={item.key} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="ep-aside__org">
          <span className="ep-aside__org-avatar">{company.slice(0, 1).toUpperCase()}</span>
          <span className="ep-aside__org-name">{company}</span>
        </div>
        <button type="button" className="ep-aside__logout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function EmployerMobileNav() {
  const pathname = usePathname();
  const mobile = [
    { href: '/employer', label: 'Home', key: 'home' },
    { href: '/employer/jobs', label: 'Jobs', key: 'jobs' },
    { href: '/employer/candidates', label: 'Talent', key: 'candidates' },
    { href: '/employer/interviews', label: 'Interviews', key: 'interviews' },
    { href: '/employer/profile', label: 'Profile', key: 'profile' },
  ];
  return (
    <nav className="ep-mobile-nav" aria-label="Employer mobile">
      {mobile.map((item) => {
        const active =
          item.href === '/employer'
            ? pathname === '/employer'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={active ? 'is-active' : ''}>
            <NavIcon name={item.key} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
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
  return (
    <div className="ep-pagehead">
      <div>
        {title ? (
          <h1 className="ep-pagehead__title">
            <TinyEagleIcon className="ep-pagehead__eagle" size={14} />
            {title}
          </h1>
        ) : null}
        {subtitle ? <p className="ep-pagehead__sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="ep-pagehead__action">{action}</div> : null}
    </div>
  );
}

function EmployerLayout({
  profile,
  children,
  onSignOut,
}: {
  profile: EmployerShellProfile;
  children: ReactNode;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [impersonation, setImpersonation] = useState(() => getEmployerImpersonation());

  useEffect(() => {
    setImpersonation(getEmployerImpersonation());
  }, []);

  function exitToAdmin() {
    if (endEmployerImpersonation()) {
      router.replace('/adminsrsb/dashboard?tab=employers');
      return;
    }
    void onSignOut();
  }

  return (
    <div className="ep-app ep-app--desk ep-app--saas ep-app--leftnav">
      <EmployerRightNav profile={profile} onSignOut={impersonation ? exitToAdmin : onSignOut} />
      <div className="ep-main">
        <EmployerDeskBar
          profile={profile}
          onSignOut={impersonation ? exitToAdmin : onSignOut}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
        {impersonation ? (
          <div className="ep-impersonation-banner" role="status">
            <p>
              Super admin mode · Acting as <strong>{impersonation.companyName}</strong>. Full employer
              access (jobs, candidates, interviews, profile).
            </p>
            <button type="button" onClick={exitToAdmin}>
              Exit to admin
            </button>
          </div>
        ) : null}
        <div className="ep-content">{children}</div>
      </div>
      <EmployerMobileNav />
    </div>
  );
}

export function EmployerShell({
  profile,
  title: _title,
  children,
}: {
  profile: EmployerShellProfile;
  title?: string;
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
    <EmployerLayout profile={profile} onSignOut={signOut}>
      {children}
    </EmployerLayout>
  );
}

export function EmployerShellFallback({
  title: _title,
  children,
}: {
  title?: string;
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
    <EmployerLayout profile={profile} onSignOut={signOut}>
      {children}
    </EmployerLayout>
  );
}

/** @deprecated Use EmployerShellFallback — kept so older pages do not crash */
export const EmployerPortal = EmployerShellFallback;

export { statusLabel };
