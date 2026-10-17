'use client';

import Link from 'next/link';

/** Segmented control: View Resume ↔ ATS Checker (desktop + mobile page header). */
export function ResumeAtsTopSwitcher({ active }: { active: 'resumes' | 'ats' }) {
  return (
    <div
      className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-1"
      role="tablist"
      aria-label="Resume tools"
    >
      <Link
        href="/resumes"
        role="tab"
        aria-selected={active === 'resumes'}
        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
          active === 'resumes'
            ? 'bg-[#1a1fc4] text-white shadow-sm'
            : 'text-slate-600 hover:text-[#10137c]'
        }`}
      >
        View Resume
      </Link>
      <Link
        href="/ats"
        role="tab"
        aria-selected={active === 'ats'}
        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
          active === 'ats'
            ? 'bg-[#1a1fc4] text-white shadow-sm'
            : 'text-slate-600 hover:text-[#10137c]'
        }`}
      >
        ATS Checker
      </Link>
    </div>
  );
}
