'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { EmployerProfile, EmployerVerificationStatus } from '@careerbridge/shared';
import { getEmployerMe, logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { NotificationBell } from '@/components/NotificationBell';

export type EmployerShellProfile = Pick<
  EmployerProfile,
  'companyName' | 'verificationStatus' | 'contactName' | 'industry' | 'city' | 'workEmail' | 'designation'
>;

const PRIMARY_NAV = [
  { href: '/employer', label: 'Dashboard', key: 'home' },
  { href: '/employer/jobs', label: 'Jobs', key: 'jobs' },
  { href: '/employer/candidates', label: 'Candidates', key: 'candidates' },
  { href: '/employer/interviews', label: 'Interviews', key: 'interviews' },
  { href: '/employer/applications', label: 'Applications', key: 'applications' },
  { href: '/employer/reports', label: 'Reports', key: 'reports' },
] as const;

const ACCOUNT_NAV = [
  { href: '/employer/profile', label: 'Company profile', key: 'profile' },
] as const;

function NavIcon({ name }: { name: string }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 10.5 12 4.5l7.5 6v9a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19.5v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.5 20.5v-6.5h5v6.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'jobs') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (name === 'candidates') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 18.5c.8-2.8 2.6-4 4.5-4s3.7 1.2 4.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'interviews') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'applications') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-3-1.5-3 1.5-3-1.5-3 1.5V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 9h6M9 12.5h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'reports') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 19.5V10M12 19.5V4.5M18 19.5V13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'profile') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6 19.5c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
  if (key === 'reports') return pathname.startsWith('/employer/reports');
  if (key === 'profile') return pathname.startsWith('/employer/profile');
  return false;
}

function statusLabel(status?: EmployerVerificationStatus | string | null) {
  if (status === 'VERIFIED') return 'Active';
  if (status === 'PENDING') return 'Pending';
  if (status === 'REJECTED') return 'Needs fix';
  if (status === 'KYC_COMPLETE') return 'In review';
  return 'Setup';
}

function EmployerAside({
  profile,
  onSignOut,
}: {
  profile: EmployerShellProfile;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const company = profile.companyName?.trim() || 'Company';

  return (
    <aside className="ep-aside" aria-label="Employer navigation">
      <Link href="/employer" className="ep-aside__brand">
        <Image
          src="/srsb-wordmark.png"
          alt="SRSB CareerBridge"
          width={408}
          height={170}
          className="ep-aside__wordmark"
          unoptimized
          priority
        />
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
            {item.label}
          </Link>
        ))}
      </nav>

      <p className="ep-aside__group">Account</p>
      <nav className="ep-aside__nav ep-aside__nav--account" aria-label="Account">
        {ACCOUNT_NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`ep-aside__link ${isActive(pathname, item.key) ? 'is-active' : ''}`}
          >
            <span className="ep-aside__ico">
              <NavIcon name={item.key} />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ep-aside__foot">
        <div className="ep-aside__progress">
          Status · {statusLabel(profile.verificationStatus)}
          <div className="ep-aside__bar">
            <span
              style={{
                width:
                  profile.verificationStatus === 'VERIFIED'
                    ? '100%'
                    : profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'KYC_COMPLETE'
                      ? '72%'
                      : '35%',
              }}
            />
          </div>
        </div>
        <div className="ep-aside__org">
          <span className="ep-aside__org-avatar">{company.slice(0, 1).toUpperCase()}</span>
          <span className="ep-aside__org-name">{company}</span>
          <button type="button" className="ep-aside__logout" onClick={onSignOut}>
            Logout
          </button>
        </div>
      </div>
    </aside>
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

  return (
    <header className="ep-deskbar">
      <div className="ep-deskbar__left">
        <button
          type="button"
          className="ep-deskbar__menu lg:hidden"
          aria-label="Open menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
        <Link href="/employer" className="ep-deskbar__logo lg:hidden" aria-label="Dashboard">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="ep-deskbar__wordmark"
            unoptimized
          />
        </Link>
        <label className="ep-deskbar__search hidden md:flex">
          <span className="sr-only">Search</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M15 15.5 19.5 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Search jobs, candidates..." />
        </label>
      </div>
      <div className="ep-deskbar__right">
        <NotificationBell variant="employer" />
        <div className="ep-deskbar__user">
          <span className="ep-deskbar__user-meta hidden sm:block">
            <strong>{displayName}</strong>
            <em>{company}</em>
          </span>
          <button
            type="button"
            className="ep-deskbar__logout-btn"
            onClick={onSignOut}
          >
            Logout
          </button>
          <button type="button" className="ep-deskbar__avatar" onClick={onSignOut} title="Logout">
            {displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav className="ep-deskbar__drawer lg:hidden" aria-label="Mobile menu">
          {[...PRIMARY_NAV, ...ACCOUNT_NAV].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={isActive(pathname, item.key) ? 'is-active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <button type="button" className="ep-deskbar__drawer-logout" onClick={onSignOut}>
            Logout
          </button>
        </nav>
      ) : null}
    </header>
  );
}

export function EmployerMobileNav() {
  const pathname = usePathname();
  const mobile = [
    { href: '/employer', label: 'Home', key: 'home' },
    { href: '/employer/jobs', label: 'Jobs', key: 'jobs' },
    { href: '/employer/candidates', label: 'Candidates', key: 'candidates' },
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
            {item.label}
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
        {title ? <h1 className="ep-pagehead__title">{title}</h1> : null}
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="ep-app ep-app--desk">
      <EmployerAside profile={profile} onSignOut={onSignOut} />
      <div className="ep-main">
        <EmployerDeskBar
          profile={profile}
          onSignOut={onSignOut}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
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
    await logout();
    router.replace('/');
  }

  return (
    <EmployerLayout profile={profile} onSignOut={signOut}>
      {children}
    </EmployerLayout>
  );
}

export { statusLabel };
