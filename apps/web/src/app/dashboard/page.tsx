'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCandidateMe,
  getProfileCompletion,
  listApplications,
  listJobs,
  recommendedJobs,
  fetchMe,
  updateCandidateMe,
} from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import type { CandidateProfile, JobCard } from '@careerbridge/shared';
import { CandidateDashboardShell } from '@/components/CandidateDashboardShell';
import { DashboardCareerPassport } from '@/components/dashboard/DashboardCareerPassport';
import {
  fetchScheduledInterviews,
  type ScheduledJobInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';

function formatPersonName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatSalaryShort(min?: number | null, max?: number | null) {
  if (!min && !max) return 'Salary not listed';
  const fmt = (value: number) => {
    if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
    return `₹${value.toLocaleString('en-IN')}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatInterviewDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status: ScheduledJobInterview['status']) {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'RESCHEDULE_REQUESTED') return 'Reschedule requested';
  return 'Pending confirmation';
}

function strengthLabel(value: number) {
  if (value >= 80) return 'High';
  if (value >= 50) return 'Medium';
  return 'Getting started';
}

function ProfileStrengthRing({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 108 108" aria-hidden>
        <circle cx="54" cy="54" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <p className="relative text-2xl font-black text-[#111827]">{safe}%</p>
    </div>
  );
}

function CareerPathMilestone() {
  return (
    <div className="relative flex h-full min-h-[180px] flex-col overflow-hidden rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4 sm:p-5">
      <div className="relative z-[1] flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1e3a8a]">Career Pathing Milestone</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dashboard/passport-sparkle.gif"
          alt=""
          className="h-6 w-6 object-contain opacity-90"
        />
      </div>

      <div className="relative z-[1] mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-xl">
        {/* Realistic scene */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dashboard/career-milestone-hero.png"
          alt="Career path toward your next role"
          className="cb-mile-hero h-[120px] w-auto max-w-[78%] object-contain drop-shadow-sm sm:h-[132px]"
        />

        {/* Floating pin */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dashboard/career-milestone-pin.png"
          alt=""
          className="cb-mile-pin pointer-events-none absolute right-1 top-1 h-12 w-12 object-contain sm:right-2 sm:h-14 sm:w-14"
        />

        {/* Choose career character (bg removed) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dashboard/career-choose.png"
          alt=""
          className="cb-mile-choose pointer-events-none absolute bottom-0 left-0 h-14 w-auto object-contain sm:h-16"
        />
      </div>

      <p className="relative z-[1] mt-3 text-xs font-medium text-[#3b82f6]">
        Keep building — your next role is ahead.
      </p>

      <style jsx>{`
        .cb-mile-hero {
          animation: cb-mile-float 4.2s ease-in-out infinite;
        }
        .cb-mile-pin {
          animation: cb-mile-bob 2.4s ease-in-out infinite;
        }
        .cb-mile-choose {
          animation: cb-mile-slide 5s ease-in-out infinite;
        }
        @keyframes cb-mile-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes cb-mile-bob {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-7px) scale(1.05);
          }
        }
        @keyframes cb-mile-slide {
          0%,
          100% {
            transform: translateX(0);
            opacity: 0.95;
          }
          50% {
            transform: translateX(6px);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cb-mile-hero,
          .cb-mile-pin,
          .cb-mile-choose {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function AccentStat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      style={{ borderTopWidth: 3, borderTopColor: accent }}
    >
      <p className="text-xl font-black tracking-tight text-[#111827] sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
    </div>
  );
}

function RecommendedJobCard({
  job,
  cityFallback,
  onView,
  onApply,
}: {
  job: JobCard;
  cityFallback: string;
  onView: () => void;
  onApply: () => void;
}) {
  const matchScore = job.match?.score;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#111827]">{job.title}</h3>
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">
        {job.companyName} | {job.city || cityFallback}
      </p>
      <p className="mt-3 text-sm font-extrabold text-[#111827]">
        {formatSalaryShort(job.salaryMin, job.salaryMax)}
      </p>
      {typeof matchScore === 'number' ? (
        <p className="mt-1 text-xs font-bold text-emerald-600">{matchScore}% match</p>
      ) : (
        <p className="mt-1 text-xs font-medium text-slate-400">Recommended</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onView}
          className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-lg bg-[#f59e0b] py-2 text-xs font-bold text-[#111827] hover:brightness-105"
        >
          Apply
        </button>
      </div>
    </article>
  );
}

function ScheduledInterviewCard({
  interview,
  onOpen,
  onPrepare,
}: {
  interview: ScheduledJobInterview;
  onOpen: () => void;
  onPrepare: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#111827]">
          {interview.mode === 'VIDEO' ? 'Video' : 'In person'}
        </p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          {statusLabel(interview.status)}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-snug text-[#111827]">
        {interview.jobTitle}
      </h3>
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">{interview.companyName}</p>
      <p className="mt-3 text-sm font-extrabold text-[#111827]">{formatInterviewDate(interview.scheduledDate)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{interview.scheduledTime}</p>
      {interview.location ? (
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{interview.location}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
        <button
          type="button"
          onClick={onPrepare}
          className="flex-1 rounded-lg bg-[#f59e0b] py-2 text-xs font-bold text-[#111827] hover:brightness-105"
        >
          Prepare
        </button>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,248px)_minmax(0,1fr)]">
        <div className="h-[360px] max-w-[248px] animate-pulse rounded-2xl bg-slate-200" />
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-[180px] animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-[180px] animate-pulse rounded-2xl bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [city, setCity] = useState('');
  const [completionPercent, setCompletionPercent] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledJobInterview[]>([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (stored.role === 'EMPLOYER_ADMIN' || stored.role === 'EMPLOYER_RECRUITER') {
      router.replace('/employer');
      return;
    }

    fetchMe()
      .then((me) => {
        const onboardingDone = me.onboardingCompleted ?? stored.onboardingCompleted;
        const dashboardReached = me.dashboardReached ?? stored.dashboardReached ?? false;
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted: onboardingDone,
          dashboardReached,
        });
        if (!onboardingDone) {
          router.replace('/onboarding/continue');
          return;
        }

        setName(formatPersonName(me.firstName || stored.firstName || 'there'));
        setReady(true);

        const markDashboard = dashboardReached
          ? Promise.resolve()
          : updateCandidateMe({ dashboardReached: true })
              .then(() => patchStoredUser({ dashboardReached: true }))
              .catch(() => undefined);

        return Promise.all([
          markDashboard,
          getCandidateMe(),
          getProfileCompletion(),
          recommendedJobs()
            .then((result) => result.items || [])
            .catch(() => listJobs({ limit: 8 }).then((result) => result.items || []).catch(() => [])),
          fetchScheduledInterviews().catch(() => [] as ScheduledJobInterview[]),
          listApplications()
            .then((rows) => rows.length)
            .catch(() => 0),
        ]).then(([, candidateProfile, completion, jobItems, interviews, appsCount]) => {
          setProfile(candidateProfile);
          setName(
            formatPersonName(candidateProfile.firstName || me.firstName || stored.firstName || 'there'),
          );
          if (candidateProfile.city) setCity(candidateProfile.city);
          const percent = completion?.percentage ?? candidateProfile.profileCompletion ?? 0;
          setCompletionPercent(percent);
          setJobs(jobItems.slice(0, 4));
          const upcoming = interviews
            .filter((item) => item.status !== 'RESCHEDULE_REQUESTED')
            .sort((a, b) =>
              `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`),
            );
          setScheduledInterviews(upcoming);
          setApplicationCount(appsCount);
        });
      })
      .catch(() => {
        if (!stored.onboardingCompleted) {
          router.replace('/onboarding/continue');
          return;
        }
        setName(formatPersonName(stored.firstName || 'there'));
        setReady(true);
      });
  }, [router]);

  const displayJobs = jobs.slice(0, 4);
  const displayInterviews = scheduledInterviews.slice(0, 4);
  const isProfileComplete = completionPercent >= 100;
  const skillsCount = profile?.skills?.length || 0;

  if (!ready) {
    return (
      <CandidateDashboardShell>
        <DashboardSkeleton />
      </CandidateDashboardShell>
    );
  }

  return (
    <CandidateDashboardShell avatarUrl={profile?.photoUrl}>
      <div className="mx-auto w-full space-y-6 lg:space-y-7">
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(220px,248px)_minmax(0,1fr)] lg:gap-5">
          <div className="order-2 w-full lg:order-1 lg:sticky lg:top-24">
            {profile ? (
              <DashboardCareerPassport
                profile={{ ...profile, profileCompletion: completionPercent }}
              />
            ) : (
              <div className="h-[360px] max-w-[248px] animate-pulse rounded-2xl bg-slate-200" />
            )}
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
            <div>
              <h1 className="text-[2rem] font-extrabold tracking-tight text-[#111827] sm:text-[2.35rem]">
                Hello {name} 👋
              </h1>
              <p className="mt-1.5 text-base text-slate-500">
                {isProfileComplete
                  ? 'Your Career Passport looks strong — explore matching roles.'
                  : 'Keep going — finish your profile to unlock tailored matches.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                <ProfileStrengthRing value={completionPercent} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-600">
                    Profile Strength:{' '}
                    <span className="font-extrabold text-[#111827]">{strengthLabel(completionPercent)}</span>
                  </p>
                  {!isProfileComplete ? (
                    <button
                      type="button"
                      onClick={() => router.push('/profile')}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#f59e0b] px-4 py-2.5 text-sm font-bold text-[#111827] transition hover:brightness-105"
                    >
                      Complete Profile
                      <span aria-hidden>→</span>
                    </button>
                  ) : (
                    <span className="mt-3 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                      Profile complete
                    </span>
                  )}
                </div>
              </div>

              <CareerPathMilestone />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AccentStat value={`${completionPercent}%`} label="Strength" accent="#f59e0b" />
              <AccentStat value={String(skillsCount)} label="Skills Added" accent="#22c55e" />
              <AccentStat value={String(applicationCount)} label="Applications" accent="#3b82f6" />
              <AccentStat value={String(scheduledInterviews.length)} label="Interviews" accent="#a855f7" />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-[#111827]">Recommended Jobs</h2>
                <button
                  type="button"
                  className="text-sm font-bold text-[#2563eb] hover:underline"
                  onClick={() => router.push('/jobs')}
                >
                  View all jobs →
                </button>
              </div>

              {displayJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff] text-[#3b82f6]">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">No direct matches found yet.</p>
                  <button
                    type="button"
                    className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-[#111827] hover:bg-slate-50"
                    onClick={() => router.push('/jobs')}
                  >
                    Browse all jobs
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {displayJobs.map((job) => (
                    <RecommendedJobCard
                      key={job.id}
                      job={job}
                      cityFallback={city || 'India'}
                      onView={() => router.push(`/jobs/${job.id}`)}
                      onApply={() => router.push(`/jobs/${job.id}/apply`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[#111827]">Scheduled Interviews</h2>
            <button
              type="button"
              className="text-sm font-bold text-[#2563eb] hover:underline"
              onClick={() => router.push('/interviews')}
            >
              View all interviews →
            </button>
          </div>

          {displayInterviews.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-[#111827]">No interviews scheduled yet</p>
              <p className="mt-1 text-sm text-slate-500">
                When an employer schedules an interview, it will show up here.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-[#111827] hover:bg-slate-50"
                  onClick={() => router.push('/applications')}
                >
                  Track applications
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-bold text-[#111827] hover:brightness-105"
                  onClick={() => router.push('/interviews/mock')}
                >
                  Practice mock interview
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {displayInterviews.map((interview) => (
                <ScheduledInterviewCard
                  key={interview.id}
                  interview={interview}
                  onOpen={() => router.push(`/interviews/scheduled/${interview.id}`)}
                  onPrepare={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </CandidateDashboardShell>
  );
}
