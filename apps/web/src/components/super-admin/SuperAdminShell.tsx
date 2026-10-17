'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { canOpenAdminTab, type SuperAdminNavId } from '@/lib/admin-portal';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AdminNavIcon } from '@/components/super-admin/admin-icons';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import '@/components/super-admin/super-admin-shell.css';

export type { SuperAdminNavId };

const NAV: Array<{ id: SuperAdminNavId; label: string; href: string }> = [
  { id: 'dashboard', label: 'Dashboard', href: '/adminsrsb/dashboard' },
  { id: 'candidates', label: 'Candidates', href: '/adminsrsb/dashboard?tab=candidates' },
  { id: 'employers', label: 'Employers', href: '/adminsrsb/dashboard?tab=employers' },
  { id: 'jobs', label: 'Jobs', href: '/adminsrsb/dashboard?tab=jobs' },
  { id: 'applications', label: 'Applications', href: '/adminsrsb/dashboard?tab=applications' },
  { id: 'interviews', label: 'Interviews', href: '/adminsrsb/dashboard?tab=interviews' },
  { id: 'skills', label: 'Skills', href: '/adminsrsb/dashboard?tab=skills' },
  { id: 'ai-usage', label: 'AI Usage', href: '/adminsrsb/dashboard?tab=ai-usage' },
  { id: 'notifications', label: 'Notifications', href: '/adminsrsb/dashboard?tab=notifications' },
  { id: 'testimonials', label: 'Testimonials', href: '/adminsrsb/dashboard?tab=testimonials' },
  { id: 'reports', label: 'Reports', href: '/adminsrsb/dashboard?tab=reports' },
  { id: 'admins', label: 'Administration', href: '/adminsrsb/dashboard?tab=admins' },
  { id: 'settings', label: 'Settings', href: '/adminsrsb/dashboard?tab=settings' },
  { id: 'audit', label: 'Audit', href: '/adminsrsb/dashboard?tab=audit' },
  { id: 'account', label: 'My Account', href: '/adminsrsb/dashboard?tab=account' },
];

function shellMeta(role?: string | null) {
  if (role === 'SUPER_ADMIN') {
    return { brandRole: 'Super Admin', tag: 'Command bridge', shell: 'role-shell role-shell--super' };
  }
  if (role === 'PLATFORM_OPERATOR') {
    return { brandRole: 'Operator', tag: 'Ops floor', shell: 'role-shell role-shell--ops' };
  }
  return { brandRole: 'Admin', tag: 'Admin console', shell: 'role-shell role-shell--admin' };
}

export function SuperAdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: SuperAdminNavId;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const role = user?.role;
  const items = NAV.filter((item) => canOpenAdminTab(role, item.id));
  const meta = shellMeta(role);

  return (
    <div className={`${meta.shell} min-h-screen`}>
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="role-shell__scrim fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`role-shell__aside fixed inset-y-0 left-0 z-50 flex w-[230px] flex-col transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="role-shell__brand flex h-14 items-center border-b px-3">
          <BrandLogo
            href="/adminsrsb/dashboard"
            role={meta.brandRole}
            tone="dark"
            size="sm"
            priority
            onClick={() => setOpen(false)}
          />
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`role-shell__nav-link flex min-h-[42px] items-center gap-3 px-3 text-[13px] transition ${
                  isActive ? 'role-shell__nav-link--active' : ''
                }`}
              >
                <AdminNavIcon id={item.id} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[230px]">
        <header className="role-shell__header sticky top-0 z-30 flex h-14 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="role-shell__menu-btn inline-flex h-10 w-10 items-center justify-center lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span className="flex flex-col gap-1">
                <span className="role-shell__burger block h-0.5 w-4" />
                <span className="role-shell__burger block h-0.5 w-4" />
                <span className="role-shell__burger block h-0.5 w-4" />
              </span>
            </button>
            <span className="role-shell__header-label text-sm font-semibold">{meta.tag}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="role-shell__public hidden px-3.5 text-xs sm:inline-flex">
              Public site
            </Link>
            <button
              type="button"
              className="role-shell__signout px-3.5 text-xs"
              onClick={async () => {
                await logout();
                router.replace('/adminsrsb');
              }}
            >
              Sign out
            </button>
            <span className="role-shell__avatar ml-1 flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold">
              {(user?.firstName?.[0] || user?.phone?.slice(-1) || 'A').toUpperCase()}
            </span>
          </div>
        </header>

        <main className="role-shell__main px-3 py-4 sm:px-5 sm:py-5">{children}</main>
      </div>
    </div>
  );
}
