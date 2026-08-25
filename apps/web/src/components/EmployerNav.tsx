'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/AuthShell';
import { BackButton } from '@/components/ui/BackButton';
import { EmployerMobileNav } from '@/components/EmployerPortal';

const ITEMS = [
  { href: '/employer', label: 'Home' },
  { href: '/employer/jobs', label: 'Jobs' },
  { href: '/employer/applications', label: 'Applications' },
  { href: '/employer/profile', label: 'Company' },
];

export function EmployerHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <BackButton fallback="/employer" />
      <Logo />
    </div>
  );
}

/** @deprecated Prefer EmployerMobileNav from EmployerPortal for new pages */
export function EmployerNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/10 bg-surface/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-2">
        {ITEMS.map((item) => {
          const active =
            item.href === '/employer' ? pathname === '/employer' : pathname.startsWith(item.href);
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

export { EmployerMobileNav };
