'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type CandidateTab = 'home' | 'jobs' | 'applications' | 'interviews' | 'profile';

export function CandidateBottomNav({ activeTab }: { activeTab?: CandidateTab }) {
  const pathname = usePathname();

  const currentTab =
    activeTab ||
    (pathname.startsWith('/jobs')
      ? 'jobs'
      : pathname.startsWith('/applications')
        ? 'applications'
        : pathname.startsWith('/interviews')
          ? 'interviews'
          : pathname.startsWith('/passport') || pathname.startsWith('/profile')
            ? 'profile'
            : 'home');

  const items: Array<{
    id: CandidateTab;
    label: string;
    href: string;
    icon: (active: boolean) => React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Home',
      href: '/dashboard',
      icon: (active) => (
        <svg
          className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'jobs',
      label: 'Jobs',
      href: '/jobs',
      icon: (active) => (
        <svg
          className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'applications',
      label: 'Applications',
      href: '/applications',
      icon: (active) => (
        <svg
          className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'interviews',
      label: 'Interviews',
      href: '/interviews',
      icon: (active) => (
        <svg
          className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: (active) => (
        <svg
          className={`h-5 w-5 transition-colors ${active ? 'stroke-[#0a2e2c] stroke-2' : 'stroke-slate-400 stroke-[1.75]'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-md items-center justify-around py-2 px-2 sm:px-4">
        {items.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-all ${
                isActive ? 'text-[#0a2e2c] font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.icon(isActive)}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
