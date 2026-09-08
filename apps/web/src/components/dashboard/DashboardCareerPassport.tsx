'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CandidateProfile, ResumeRecord } from '@careerbridge/shared';
import { DashboardResumePreviewModal } from '@/components/dashboard/DashboardResumePreviewModal';
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
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const skills = profile.skills.map((item) => item.name).filter(Boolean);
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
    <>
      <article className="w-full overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Career Passport
          </p>
          <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#059669]">
            Free
          </span>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0a2e2c] text-base font-extrabold text-white">
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

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Summary</p>
            <p className="cb-passport-summary-clamp mt-2 text-sm leading-relaxed text-slate-600">
              {summary}
            </p>
          </div>

          <span className="mt-4 inline-flex rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-bold text-[#047857]">
            {experienceLine}
          </span>

          {skills.length > 0 ? (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.slice(0, 6).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-xs font-semibold text-[#047857]"
                  >
                    {prettyText(skill)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-xl border border-[#0a2e2c]/25 py-3 text-center text-sm font-bold text-[#0a2e2c] transition hover:bg-[#f3faf7]"
            >
              Preview Resume
            </button>
            <Link
              href="/profile"
              className="rounded-xl bg-[#0a2e2c] py-3 text-center text-sm font-bold text-white transition hover:bg-[#072422]"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </article>

      {previewOpen ? (
        <DashboardResumePreviewModal profile={profile} onClose={() => setPreviewOpen(false)} />
      ) : null}

      <style jsx global>{`
        .cb-passport-summary-clamp {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }
      `}</style>
    </>
  );
}
