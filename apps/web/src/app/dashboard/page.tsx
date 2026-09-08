'use client';

import Image from 'next/image';
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
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { DashboardCareerPassport } from '@/components/dashboard/DashboardCareerPassport';
import { Button } from '@/components/ui/Button';
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
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#0a2e2c]">{job.title}</h3>
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">
        {job.companyName} | {job.city || cityFallback}
      </p>
      <p className="mt-3 text-sm font-extrabold text-[#0a2e2c]">
        {formatSalaryShort(job.salaryMin, job.salaryMax)}
      </p>
      {typeof matchScore === 'number' ? (
        <p className="mt-1 text-xs font-bold text-[#16a34a]">{matchScore}% match</p>
      ) : (
        <p className="mt-1 text-xs font-medium text-slate-400">Recommended</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onView}
          className="flex-1 rounded-xl border-slate-200 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          View
        </Button>
        <Button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-xl bg-[#0a2e2c] py-2 text-xs font-bold text-white hover:bg-[#072422]"
        >
          Apply
        </Button>
      </div>
    </article>
  );
}

function SeeAllJobsCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[190px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center shadow-sm transition hover:border-[#0a2e2c]/40 hover:shadow-md"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0a2e2c] text-white transition group-hover:scale-105">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </span>
      <span className="text-sm font-extrabold text-[#0a2e2c]">See all jobs</span>
      <span className="text-[11px] font-medium text-slate-500">Browse full marketplace</span>
    </button>
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
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#0d9488]">
          {interview.mode === 'VIDEO' ? 'Video' : 'In person'}
        </p>
        <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
          {statusLabel(interview.status)}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-snug text-[#0a2e2c]">
        {interview.jobTitle}
      </h3>
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">{interview.companyName}</p>
      <p className="mt-3 text-sm font-extrabold text-[#0a2e2c]">
        {formatInterviewDate(interview.scheduledDate)}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{interview.scheduledTime}</p>
      {interview.location ? (
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{interview.location}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onOpen}
          className="flex-1 rounded-xl border-slate-200 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          View
        </Button>
        <Button
          type="button"
          onClick={onPrepare}
          className="flex-1 rounded-xl bg-[#0a2e2c] py-2 text-xs font-bold text-white hover:bg-[#072422]"
        >
          Prepare
        </Button>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[96px] items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm sm:min-h-[108px] sm:px-5 sm:py-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#0a2e2c] sm:h-14 sm:w-14">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-none text-[#0a2e2c] sm:text-2xl">{value}</p>
        <p className="mt-1.5 truncate text-xs font-semibold text-slate-500 sm:text-[13px]">{label}</p>
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
      <CandidateAppShell activeTab="home" maxWidth="max-w-7xl">
        <div className="p-12 text-center text-sm text-slate-500">Loading dashboard...</div>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="home" maxWidth="max-w-7xl" avatarUrl={profile?.photoUrl}>
      <div className="mx-auto w-full space-y-8 lg:space-y-10">
        <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,380px)] lg:gap-8">
          <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full lg:gap-5">
            <div className="flex flex-1 flex-col justify-center overflow-hidden rounded-[28px] border border-[#d7ebe4] bg-gradient-to-br from-[#edf8f4] via-[#f7fbf9] to-white px-6 py-7 sm:px-8 sm:py-8 lg:min-h-0">
              <div className="flex h-full flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <div className="min-w-0 flex-1 space-y-5">
                  <div>
                    <h1 className="text-[2.35rem] font-extrabold leading-[1.1] tracking-tight text-[#0a2e2c] sm:text-[2.75rem]">
                      Hello {name} 👋
                    </h1>
                    <p className="mt-2 text-lg text-slate-600 sm:text-xl">
                      Welcome back!{' '}
                      {isProfileComplete
                        ? 'Your profile looks great.'
                        : 'Keep going — finish your profile for better matches.'}
                    </p>
                  </div>

                  {isProfileComplete ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0a2e2c] px-4 py-1.5 text-sm font-bold text-white">
                      Profile complete - {completionPercent}%
                    </span>
                  ) : (
                    <div className="max-w-md space-y-2">
                      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                        <span>Profile progress</span>
                        <span>{completionPercent}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200">
                        <div
                          className="h-full rounded-full bg-[#0a2e2c] transition-all"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => router.push('/profile')}
                        className="mt-2 rounded-xl bg-[#0a2e2c] px-5 py-2.5 text-sm font-bold text-white"
                      >
                        Complete Profile
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mx-auto w-full max-w-[360px] shrink-0 lg:mx-0 lg:w-[46%] lg:max-w-none">
                  <Image
                    src="/dashboard/hero-workspace.png"
                    alt=""
                    width={720}
                    height={480}
                    className="h-auto w-full object-contain"
                    unoptimized
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:shrink-0">
              <StatCard
                label="Profile Strength"
                value={`${completionPercent}%`}
                icon={
                  <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21l4-2 4 2V5a2 2 0 00-2-2H10a2 2 0 00-2 2v16z" />
                  </svg>
                }
              />
              <StatCard
                label="Skills Added"
                value={String(skillsCount)}
                icon={
                  <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                }
              />
              <StatCard
                label="Applications"
                value={String(applicationCount)}
                icon={
                  <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                    />
                  </svg>
                }
              />
              <StatCard
                label="Interviews"
                value={String(scheduledInterviews.length)}
                icon={
                  <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                    />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="w-full">
            {profile ? (
              <DashboardCareerPassport profile={{ ...profile, profileCompletion: completionPercent }} />
            ) : (
              <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading Career Passport…
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[#0a2e2c]">Recommended Jobs</h2>
            <button
              type="button"
              className="text-sm font-bold text-[#0a2e2c] hover:underline"
              onClick={() => router.push('/jobs')}
            >
              View all jobs →
            </button>
          </div>

          {displayJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
              <p className="text-sm text-slate-600">
                No published employer jobs match your profile yet. Browse all jobs to explore openings.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl text-sm font-bold"
                onClick={() => router.push('/jobs')}
              >
                Browse jobs
              </Button>
            </div>
          ) : (
            <div className="cb-dashboard-jobs-row -mx-1 px-1">
              {displayJobs.map((job) => (
                <div key={job.id} className="cb-dashboard-job-slot">
                  <RecommendedJobCard
                    job={job}
                    cityFallback={city || 'India'}
                    onView={() => router.push(`/jobs/${job.id}`)}
                    onApply={() => router.push(`/jobs/${job.id}/apply`)}
                  />
                </div>
              ))}
              <div className="cb-dashboard-job-slot">
                <SeeAllJobsCard onClick={() => router.push('/jobs')} />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[#0a2e2c]">Scheduled Interviews</h2>
            <button
              type="button"
              className="text-sm font-bold text-[#0a2e2c] hover:underline"
              onClick={() => router.push('/interviews')}
            >
              View all interviews →
            </button>
          </div>

          {displayInterviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
              <p className="text-sm font-semibold text-[#0a2e2c]">No interviews scheduled yet</p>
              <p className="mt-1 text-sm text-slate-600">
                When an employer schedules an interview, it will show up here with date and time.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl text-sm font-bold"
                  onClick={() => router.push('/applications')}
                >
                  Track applications
                </Button>
                <Button
                  type="button"
                  className="rounded-xl text-sm font-bold"
                  onClick={() => router.push('/interviews/mock')}
                >
                  Practice mock interview
                </Button>
              </div>
            </div>
          ) : (
            <div className="cb-dashboard-jobs-row -mx-1 px-1">
              {displayInterviews.map((interview) => (
                <div key={interview.id} className="cb-dashboard-job-slot">
                  <ScheduledInterviewCard
                    interview={interview}
                    onOpen={() => router.push(`/interviews/scheduled/${interview.id}`)}
                    onPrepare={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                  />
                </div>
              ))}
              <div className="cb-dashboard-job-slot">
                <button
                  type="button"
                  onClick={() => router.push('/interviews')}
                  className="group flex h-full min-h-[190px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center shadow-sm transition hover:border-[#0a2e2c]/40 hover:shadow-md"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0a2e2c] text-white transition group-hover:scale-105">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                      />
                    </svg>
                  </span>
                  <span className="text-sm font-extrabold text-[#0a2e2c]">All interviews</span>
                  <span className="text-[11px] font-medium text-slate-500">Schedule & practice</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </CandidateAppShell>
  );
}
