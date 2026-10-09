'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EmployabilityScore, ProfileCompletion } from '@careerbridge/shared';
import { EMPLOYABILITY_READY_COMPLETION, PROFILE_OVERVIEW_SECTION_KEYS } from '@careerbridge/shared';
import { getEmployabilityScore, getProfileCompletion } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { markResumeSeedFromProfile } from '@/features/resume/resume-wizard-draft';
import { rememberReturnTo } from '@/lib/nav-return';
import { userFacingError } from '@/lib/client-errors';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';

const CORE_LABELS: Record<string, string> = {
  personal: 'Personal Information',
  education: 'Education',
  experience: 'Experience',
  skills: 'Skills',
  preferences: 'Job Preferences',
};

const PROFILE_SECTIONS = PROFILE_OVERVIEW_SECTION_KEYS.map((key) => ({
  key,
  label: CORE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
  href: `/passport/${key}`,
}));

const MORE_SECTIONS = [
  { label: 'Certifications', href: '/passport/certifications' },
  { label: 'Languages', href: '/passport/languages' },
  { label: 'Projects', href: '/passport/projects' },
  { label: 'Portfolio', href: '/passport/links' },
  { label: 'Resume Versions', href: '/resumes' },
  { label: 'Interview History', href: '/interviews' },
  { label: 'AI Feedback', href: '/passport/ai-feedback' },
  { label: 'Employability Score', href: '#employability' },
  { label: 'Career Goals', href: '/passport/preferences' },
] as const;

const BAND_TONE: Record<EmployabilityScore['band'], string> = {
  Strong: 'text-emerald-800 bg-emerald-100',
  Good: 'text-indigo-800 bg-indigo-100',
  Developing: 'text-amber-900 bg-amber-100',
  Low: 'text-red-800 bg-red-100',
};

function SectionStatusIcon({ done }: { done: boolean }) {
  return done ? (
    <span className="text-base font-bold text-emerald-700" aria-label="Complete">
      ✓
    </span>
  ) : (
    <span className="text-base font-bold text-slate-500" aria-label="Not complete">
      ○
    </span>
  );
}

function firstIncompleteSectionHref(completion: ProfileCompletion) {
  for (const key of PROFILE_OVERVIEW_SECTION_KEYS) {
    const section = completion.sections.find((item) => item.key === key);
    if (!section?.done) return `/passport/${key}`;
  }
  return '/passport/personal';
}

function EmployabilityCard() {
  const [data, setData] = useState<EmployabilityScore | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    getEmployabilityScore()
      .then(setData)
      .catch((err) => setError(userFacingError(err, 'load your employability score')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section
      id="employability"
      aria-labelledby="employability-title"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="employability-title" className="text-base font-extrabold text-slate-900">
        Employability Score
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} className="mt-3" />
      ) : !data ? (
        <SkeletonList rows={1} label="Loading employability score…" className="mt-3" />
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-extrabold text-slate-900" data-testid="employability-score">
              {data.score}
              <span className="text-base font-bold text-slate-600">/100</span>
            </p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${BAND_TONE[data.band]}`}>{data.band}</span>
          </div>
          {!data.ready ? (
            <p className="mt-2 text-sm text-slate-700">
              Complete at least {EMPLOYABILITY_READY_COMPLETION}% of your profile for a reliable score.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {data.components.map((part) => (
              <li key={part.key} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">
                    {part.label} <span className="font-normal text-slate-600">({part.weight}%)</span>
                  </span>
                  <span className="font-bold text-slate-900">{part.score}/100</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
                  <div className="h-full rounded-full bg-[#1a1fc4]" style={{ width: `${part.score}%` }} />
                </div>
                {part.tip ? <p className="mt-1 text-xs text-slate-600">{part.tip}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            Calculated from your profile, resume ATS score, mock interviews, skills, experience and certifications.
          </p>
        </>
      )}
    </section>
  );
}

function PassportOverviewPage() {
  const router = useRouter();
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    getProfileCompletion()
      .then(setCompletion)
      .catch((err) => setError(userFacingError(err, 'load your profile')));
  }, []);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    load();
  }, [router, load]);

  const shellProps = {
    activeTab: 'profile' as const,
    showBack: true,
    title: 'Career Passport',
    headerVariant: 'simple' as const,
    maxWidth: 'max-w-lg',
    onBack: () => router.push('/dashboard'),
  };

  if (error) {
    return (
      <CandidateAppShell {...shellProps}>
        <ErrorState message={error} onRetry={load} />
      </CandidateAppShell>
    );
  }

  if (!completion) {
    return (
      <CandidateAppShell {...shellProps}>
        <SkeletonList rows={3} label="Loading profile…" />
      </CandidateAppShell>
    );
  }

  const completionPercent = completion.percentage ?? 0;
  const allSectionsComplete = completionPercent >= 100;

  return (
    <CandidateAppShell {...shellProps}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">Profile completion: {completionPercent}%</p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Profile completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercent}
          >
            <div
              className="h-full rounded-full bg-[#c2410c] transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <nav aria-label="Profile sections">
          {PROFILE_SECTIONS.map((section) => {
            const isDone = completion.sections.find((item) => item.key === section.key)?.done ?? false;
            return (
              <Link
                key={section.key}
                href={section.href}
                className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-200 py-3 transition hover:bg-white/60"
              >
                <span className="text-sm font-semibold text-slate-800">{section.label}</span>
                <SectionStatusIcon done={isDone} />
              </Link>
            );
          })}
        </nav>

        <Button
          type="button"
          onClick={() => {
            if (allSectionsComplete) {
              markResumeSeedFromProfile();
              rememberReturnTo('/passport');
              router.push('/resume?from=build');
              return;
            }
            router.push(firstIncompleteSectionHref(completion));
          }}
          className={
            allSectionsComplete
              ? 'w-full rounded-xl bg-[#1a1fc4] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#10137c]'
              : 'w-full rounded-xl bg-[#2f5ed4] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#274fb3]'
          }
        >
          {allSectionsComplete ? 'Finish' : 'Edit Profile'}
        </Button>

        <nav aria-labelledby="more-sections-title">
          <h2 id="more-sections-title" className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
            More in your Career Passport
          </h2>
          <ul className="mt-2">
            {MORE_SECTIONS.map((section) => (
              <li key={section.label}>
                <Link
                  href={section.href}
                  className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-200 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white/60"
                >
                  {section.label}
                  <span aria-hidden className="text-slate-500">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <EmployabilityCard />
      </div>
    </CandidateAppShell>
  );
}

export default function PassportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading profile...</div>}>
      <PassportOverviewPage />
    </Suspense>
  );
}
