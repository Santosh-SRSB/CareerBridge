'use client';

import Link from 'next/link';

/** Floating support entry on marketing surfaces. */
export function SupportFab() {
  return (
    <Link
      href="/support"
      className="fixed bottom-5 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-[#A9812F]/50 bg-[#152A43] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(21,42,67,0.35)] transition hover:-translate-y-0.5 hover:bg-[#1F3E63] sm:bottom-6 sm:right-6"
      aria-label="Open support"
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#A9812F] text-xs font-extrabold text-[#152A43]"
        aria-hidden
      >
        ?
      </span>
      Support
    </Link>
  );
}
