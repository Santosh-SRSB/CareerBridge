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

function pickLatestResume(items: ResumeRecord[]) {
  if (!items.length) return null;
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

function buildLocation(profile: CandidateProfile) {
  const parts = [profile.city, profile.state, profile.preferredWorkCity]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  if (!unique.length) return '';
  return `${prettyText(unique.join(', '))}, IN`;
}

function PassportStampIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/dashboard/passport-stamp.gif" alt="" className="h-5 w-5 object-contain" />
  );
}

function LocationPinIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/dashboard/passport-pin.gif" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
  );
}

function EyeIcon() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eff6ff] text-[#3b82f6]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    </span>
  );
}

function ChartIcon() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ecfdf5] text-[#10b981]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </span>
  );
}

function EditIcon() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ede9fe] text-[#7c3aed]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </span>
  );
}

function MiniScore({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="relative text-[10px] font-black text-[#111827]">{safe}</span>
    </div>
  );
}

export function DashboardCareerPassport({
  profile,
}: {
  profile: CandidateProfile;
  variant?: 'default' | 'dashboardDark';
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);

  const fullName = formatPersonName(profile.firstName, profile.lastName) || 'Candidate';
  const displayName = prettyText(fullName);
  const location = buildLocation(profile);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const skills = profile.skills.map((item) => item.name).filter(Boolean);
  const shownSkills = skills.slice(0, 6);
  const extraSkills = Math.max(0, skills.length - shownSkills.length);
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
      <article className="cb-pass-card relative w-full max-w-[248px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_28px_rgba(17,24,39,0.08)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#f59e0b] via-[#3b82f6] to-[#a855f7]" />
          <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#fff7ed]/80 blur-2xl" />
          <div className="absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-[#eff6ff]/90 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dashboard/passport-sparkle.gif"
            alt=""
            className="absolute right-2 top-8 h-8 w-8 opacity-80"
          />
        </div>

        <div className="relative z-[1] flex items-center gap-2 px-3.5 pb-0 pt-3">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <PassportStampIcon />
            Career Passport
          </p>
        </div>

        <div className="relative z-[1] space-y-2.5 px-3.5 pb-3.5 pt-2.5">
          <div className="flex items-center gap-2.5">
            <div className="cb-pass-avatar relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#111827] text-sm font-extrabold text-white ring-2 ring-[#f59e0b]/35">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials || 'C'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-extrabold leading-tight text-[#111827]">{displayName}</h3>
              {location ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <LocationPinIcon />
                  <span className="truncate">{location}</span>
                </p>
              ) : null}
            </div>
            <MiniScore value={completion} />
          </div>

          <p className="cb-passport-summary-clamp text-[11px] leading-snug text-slate-600">{summary}</p>

          <p className="truncate rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">
            {experienceLine}
          </p>

          {shownSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {shownSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 transition hover:bg-[#fff7ed] hover:text-[#c2410c]"
                >
                  {prettyText(skill)}
                </span>
              ))}
              {extraSkills > 0 ? (
                <span className="rounded-md bg-[#eff6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563eb]">
                  +{extraSkills} more
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="cb-pass-btn group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-[#111827] transition hover:-translate-y-0.5 hover:border-[#93c5fd] hover:shadow-sm"
            >
              <EyeIcon />
              Preview Resume
            </button>
            <Link
              href="/ats"
              className="cb-pass-btn group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-[#111827] transition hover:-translate-y-0.5 hover:border-[#6ee7b7] hover:shadow-sm"
            >
              <ChartIcon />
              Check ATS Score
            </Link>
            <Link
              href="/profile"
              className="cb-pass-btn group inline-flex items-center justify-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] py-1.5 text-[11px] font-bold text-[#111827] transition hover:-translate-y-0.5 hover:bg-[#e0e7ff] hover:shadow-sm"
            >
              <EditIcon />
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

        .cb-pass-card {
          animation: cb-pass-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .cb-pass-avatar {
          animation: cb-pass-glow 2.6s ease-in-out infinite;
        }

        @keyframes cb-pass-rise {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes cb-pass-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.15);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cb-pass-card,
          .cb-pass-avatar {
            animation: none !important;
          }

          .cb-pass-btn:hover {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}
