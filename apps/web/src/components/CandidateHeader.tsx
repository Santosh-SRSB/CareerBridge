'use client';

import Image from 'next/image';
import Link from 'next/link';

export function CandidateHeader({
  onBack,
  title,
  showBack = false,
}: {
  name?: string;
  onBack?: () => void;
  title?: string;
  showBack?: boolean;
}) {
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
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3.5 backdrop-blur-md">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image
          src="/srsb-mark.png"
          alt="SRSB"
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg object-contain"
          unoptimized
          priority
        />
        <span className="text-sm font-black tracking-tight text-[#0a2e2c]">CareerBridge</span>
      </Link>
    </header>
  );
}
