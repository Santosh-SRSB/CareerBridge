'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CandidateProfile, ResumeRecord } from '@careerbridge/shared';
import { formatCandidateExperienceLine } from '@/lib/format-candidate-experience';
import { listResumes } from '@/lib/api';
import { resolvePassportSummary } from '@/lib/passport-to-friend-resume';

function prettyText(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((part) => part!.charAt(0).toUpperCase() + part!.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function ScoreRing({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={radius} fill="none" stroke="#e8efed" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-sm font-extrabold text-[#0a2e2c]">{safe}</p>
        <p className="mt-0.5 text-[8px] font-bold tracking-wide text-[#16a34a]">READY</p>
      </div>
    </div>
  );
}

function pickLatestResume(items: ResumeRecord[]) {
  if (!items.length) return null;
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

export function DashboardCareerPassport({ profile }: { profile: CandidateProfile }) {
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);

  const fullName = formatPersonName(profile.firstName, profile.lastName) || 'Candidate';
  const displayName = prettyText(fullName);
  const location = prettyText(profile.city || profile.preferredWorkCity || '');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const experienceLine = formatCandidateExperienceLine(profile);
  const summary = resolvePassportSummary(profile, resumeSummary || undefined);
  const completion = profile.profileCompletion || 0;

  useEffect(() => {
    let active = true;
    listResumes()
      .then((items) => {
        if (!active) return;
        const latest = pickLatestResume(items);
        const text = latest?.summary || latest?.content?.summary || null;
        setResumeSummary(text);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="cb-passport-card relative w-full overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-[#0a2e2c]/12 px-5 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Career Passport
        </p>
        <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#059669]">
          Free
        </span>
      </div>

      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0a2e2c] text-base font-extrabold text-white ring-2 ring-[#0a2e2c]/20 ring-offset-2">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials || 'C'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold text-[#0a2e2c]">{displayName}</h3>
              {location ? <p className="truncate text-sm text-slate-500">{location}</p> : null}
            </div>
          </div>
          <ScoreRing value={completion} />
        </div>

        <p className="cb-passport-summary-2line mt-4 text-sm leading-snug text-slate-600">{summary}</p>

        <p className="mt-2 text-xs font-semibold capitalize text-[#047857]">
          {experienceLine || 'Fresher'}
        </p>

        <p className="mt-4 text-sm font-extrabold text-[#0a2e2c]">Everything About you</p>

        <Link
          href="/profile"
          className="mt-3 block w-full rounded-xl bg-[#0a2e2c] py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#072422]"
        >
          View Profile
        </Link>
      </div>

      <style jsx global>{`
        .cb-passport-card {
          border: 2.5px solid #0a2e2c;
          box-shadow:
            0 0 0 4px rgba(10, 46, 44, 0.08),
            0 0 0 7px rgba(10, 46, 44, 0.04),
            0 8px 30px rgba(15, 23, 42, 0.08);
        }
        .cb-passport-summary-2line {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }
      `}</style>
    </article>
  );
}
