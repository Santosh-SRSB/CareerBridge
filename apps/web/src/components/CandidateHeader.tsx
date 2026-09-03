'use client';

import Link from 'next/link';

export function CandidateHeader({
  name,
  onBack,
  title,
  showBack = false,
}: {
  name?: string;
  onBack?: () => void;
  title?: string;
  showBack?: boolean;
}) {
  const initials = (name || 'CB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  if (showBack) {
    return (
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            aria-label="Go back"
          >
            <svg className="h-4 w-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {title ? <h1 className="text-base font-bold text-[#0a2e2c]">{title}</h1> : null}
        </div>
        <Link
          href="/passport"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a2e2c] text-xs font-bold text-white shadow-sm"
        >
          {initials || 'CB'}
        </Link>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3.5 backdrop-blur-md">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a2e2c] text-xs font-black text-white">
          CB
        </span>
        <span className="text-sm font-black tracking-tight text-[#0a2e2c]">Career Bridge</span>
      </Link>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition relative"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        <Link
          href="/passport"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a2e2c] text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
        >
          {initials || 'CB'}
        </Link>
      </div>
    </header>
  );
}
