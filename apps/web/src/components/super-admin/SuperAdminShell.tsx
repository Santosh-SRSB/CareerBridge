'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { canOpenAdminTab, roleLabel, type SuperAdminNavId } from '@/lib/admin-portal';
import { TAB_THEME } from '@/components/super-admin/admin-tab-ui';
import { logout } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

export type { SuperAdminNavId };

const NAV: Array<{ id: SuperAdminNavId; label: string; href: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', href: '/srsbaadmin/dashboard', icon: '▣' },
  { id: 'candidates', label: 'Candidates', href: '/srsbaadmin/dashboard?tab=candidates', icon: '👤' },
  { id: 'employers', label: 'Employers', href: '/srsbaadmin/dashboard?tab=employers', icon: '🏢' },
  { id: 'jobs', label: 'Jobs', href: '/srsbaadmin/dashboard?tab=jobs', icon: '📋' },
  { id: 'applications', label: 'Applications', href: '/srsbaadmin/dashboard?tab=applications', icon: '📄' },
  { id: 'interviews', label: 'Interviews', href: '/srsbaadmin/dashboard?tab=interviews', icon: '🎥' },
  { id: 'skills', label: 'Skills', href: '/srsbaadmin/dashboard?tab=skills', icon: '✦' },
  { id: 'ai-usage', label: 'AI Usage', href: '/srsbaadmin/dashboard?tab=ai-usage', icon: '⚡' },
  { id: 'notifications', label: 'Notifications', href: '/srsbaadmin/dashboard?tab=notifications', icon: '🔔' },
  { id: 'reports', label: 'Reports', href: '/srsbaadmin/dashboard?tab=reports', icon: '📊' },
  { id: 'admins', label: 'Administration', href: '/srsbaadmin/dashboard?tab=admins', icon: '🛡' },
  { id: 'settings', label: 'Settings', href: '/srsbaadmin/dashboard?tab=settings', icon: '⚙' },
  { id: 'audit', label: 'Audit', href: '/srsbaadmin/dashboard?tab=audit', icon: '🧾' },
];

function shellMeta(role?: string | null) {
  if (role === 'SUPER_ADMIN') {
    return {
      brand: 'SRSB Super Admin',
      tag: 'Command bridge',
      shell: 'role-shell role-shell--super matrix-admin',
      signOut: 'bg-[#c9a227] hover:bg-[#b8921f] text-[#1a222c]',
    };
  }
  if (role === 'PLATFORM_OPERATOR') {
    return {
      brand: 'SRSB Operations',
      tag: 'Ops floor',
      shell: 'role-shell role-shell--ops matrix-admin',
      signOut: 'bg-cyan-500 hover:bg-cyan-400 text-[#0c2744]',
    };
  }
  return {
    brand: 'SRSB Admin',
    tag: 'Admin console',
    shell: 'role-shell role-shell--admin matrix-admin',
    signOut: 'bg-teal-600 hover:bg-teal-500 text-white',
  };
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
    <div className={`${meta.shell} min-h-screen text-[#555]`}>
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
          <Link
            href="/srsbaadmin/dashboard"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/srsb-mark.png"
              alt="SRSB"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
              unoptimized
              priority
            />
            <div className="min-w-0 leading-tight">
              <p className="role-shell__brand-title truncate text-sm font-semibold">{meta.brand}</p>
              <p className="role-shell__brand-role truncate text-[10px] uppercase tracking-wide">
                {roleLabel(role)}
              </p>
              {user?.email ? (
                <p className="role-shell__brand-email truncate text-[10px]">{user.email}</p>
              ) : null}
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {items.map((item) => {
            const isActive = active === item.id;
            const accent = TAB_THEME[item.id].accent;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`role-shell__nav-link flex items-center gap-3 px-4 py-2.5 text-[13px] transition ${
                  isActive ? 'role-shell__nav-link--active font-semibold' : ''
                }`}
                style={isActive ? { backgroundColor: accent, color: '#fff' } : undefined}
              >
                <span className="w-5 text-center text-sm opacity-90" aria-hidden>
                  {item.icon}
                </span>
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
              className="role-shell__menu-btn inline-flex h-9 w-9 items-center justify-center lg:hidden"
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
            <Link href="/" className="role-shell__public hidden px-2.5 py-1.5 text-xs font-semibold sm:inline">
              Public site
            </Link>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-bold ${meta.signOut}`}
              onClick={async () => {
                await logout();
                router.replace('/srsbaadmin');
              }}
            >
              Sign out
            </button>
            <span className="role-shell__avatar ml-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
              {(user?.firstName?.[0] || user?.phone?.slice(-1) || 'A').toUpperCase()}
            </span>
          </div>
        </header>

        <main className="role-shell__main px-3 py-4 sm:px-5 sm:py-5">{children}</main>
      </div>
    </div>
  );
}
