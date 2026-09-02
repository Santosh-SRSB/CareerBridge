'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCandidateMe,
  getProfileCompletion,
  listJobs,
  recommendedJobs,
  fetchMe,
} from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import type { JobCard } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { EagleMascot } from '@/features/candidate/passport/EagleMascot';

function formatPersonName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatSalaryShort(min?: number | null, max?: number | null) {
  if (!min || !max) return '₹18K–₹22K';
  const fmt = (value: number) => {
    if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
    return `₹${value.toLocaleString('en-IN')}`;
  };
  return `${fmt(min)}–${fmt(max)}`;
}

const FALLBACK_JOBS: JobCard[] = [
  {
    id: 'demo-job-1',
    title: 'Customer Service Executive',
    companyName: 'ABC Services',
    city: 'Chennai',
    salaryMin: 18000,
    salaryMax: 22000,
    jobType: 'FULL_TIME',
    category: 'Operations',
    requiredSkills: [],
    preferredSkills: [],
    match: { score: 86, gaps: [] },
  },
  {
    id: 'demo-job-2',
    title: 'Delivery Coordinator',
    companyName: 'ABC Services',
    city: 'Bengaluru',
    salaryMin: 18000,
    salaryMax: 22000,
    jobType: 'FULL_TIME',
    category: 'Logistics',
    requiredSkills: [],
    preferredSkills: [],
    match: { score: 84, gaps: [] },
  },
  {
    id: 'demo-job-3',
    title: 'Sales Associate',
    companyName: 'Retail Hub',
    city: 'Hyderabad',
    salaryMin: 16000,
    salaryMax: 20000,
    jobType: 'FULL_TIME',
    category: 'Sales',
    requiredSkills: [],
    preferredSkills: [],
    match: { score: 81, gaps: [] },
  },
  {
    id: 'demo-job-4',
    title: 'Data Entry Operator',
    companyName: 'FinServe India',
    city: 'Pune',
    salaryMin: 15000,
    salaryMax: 19000,
    jobType: 'FULL_TIME',
    category: 'Admin',
    requiredSkills: [],
    preferredSkills: [],
    match: { score: 79, gaps: [] },
  },
  {
    id: 'demo-job-5',
    title: 'Front Desk Executive',
    companyName: 'City Clinics',
    city: 'Mumbai',
    salaryMin: 17000,
    salaryMax: 21000,
    jobType: 'FULL_TIME',
    category: 'Healthcare',
    requiredSkills: [],
    preferredSkills: [],
    match: { score: 77, gaps: [] },
  },
];

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
  const matchScore = job.match?.score ?? 86;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">{job.title}</h3>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">
            {job.companyName} | {job.city || cityFallback}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#059669] border border-emerald-100">
          {matchScore}%
        </span>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-900">{formatSalaryShort(job.salaryMin, job.salaryMax)}</p>
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
      className="group flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#0a2e2c]/25 bg-gradient-to-br from-emerald-50/80 to-white p-4 text-center transition hover:border-[#0a2e2c]/50 hover:shadow-md"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2e2c] text-white shadow-sm transition group-hover:scale-105">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </span>
      <span className="text-sm font-bold text-[#0a2e2c]">See all jobs</span>
      <span className="text-[11px] font-medium text-slate-500">Browse full marketplace</span>
    </button>
  );
}

function UpcomingInterviewSection({ onView }: { onView: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-[#ecfdf5] via-white to-[#f0fdfa] p-5 sm:p-6 shadow-sm">
      <span
        className="cb-dashboard-sparkle pointer-events-none absolute right-8 top-4 text-amber-400"
        aria-hidden
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l1.8 5.4L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.6L12 2z" />
        </svg>
      </span>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div className="cb-dashboard-interview-eagle mx-auto w-[130px] shrink-0 sm:mx-0 sm:w-[148px]">
          <EagleMascot pose="point" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">Upcoming Interview</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Scheduled
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 sm:text-base">Customer Service Executive</p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 sm:text-sm">
            <svg className="h-4 w-4 shrink-0 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            12 Sep | 11:00 AM
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
            <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ABC Services · Chennai
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onView}
          className="w-full shrink-0 self-center rounded-xl border-[#0a2e2c]/20 bg-white/80 py-2.5 text-xs font-bold text-[#0a2e2c] backdrop-blur-sm hover:bg-white sm:w-auto sm:min-w-[160px] sm:self-end sm:text-sm"
        >
          View Interview
        </Button>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('Rahul');
  const [city, setCity] = useState('Chennai');
  const [completionPercent, setCompletionPercent] = useState(80);
  const [jobs, setJobs] = useState<JobCard[]>([]);
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
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted: onboardingDone,
        });
        if (!onboardingDone) {
          router.replace('/onboarding');
          return;
        }

        setName(formatPersonName(me.firstName || stored.firstName || 'Rahul'));
        setReady(true);

        return Promise.all([
          getCandidateMe(),
          getProfileCompletion(),
          recommendedJobs()
            .then((result) => result.items || [])
            .catch(() => listJobs({ limit: 8 }).then((result) => result.items || []).catch(() => [])),
        ]).then(([profile, completion, jobItems]) => {
          setName(formatPersonName(profile.firstName || me.firstName || stored.firstName || 'Rahul'));
          if (profile.city) setCity(profile.city);
          if (completion?.percentage) setCompletionPercent(completion.percentage);
          setJobs(jobItems.slice(0, 5));
        });
      })
      .catch(() => {
        if (!stored.onboardingCompleted) {
          router.replace('/onboarding');
          return;
        }
        setName(formatPersonName(stored.firstName || 'Rahul'));
        setReady(true);
      });
  }, [router]);

  const displayJobs = useMemo(() => {
    if (jobs.length >= 5) return jobs.slice(0, 5);
    const needed = 5 - jobs.length;
    const extras = FALLBACK_JOBS.filter((demo) => !jobs.some((job) => job.id === demo.id)).slice(0, needed);
    return [...jobs, ...extras];
  }, [jobs]);

  if (!ready) {
    return (
      <CandidateAppShell activeTab="home">
        <div className="p-12 text-center text-sm text-slate-500">Loading dashboard...</div>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="home" maxWidth="w-full">
      <div className="mx-auto w-full space-y-8 px-0 sm:px-2 lg:w-[80%] lg:max-w-[80%]">
        {/* Profile completion — unchanged */}
        <section className="space-y-4 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Hello {name} 👋
          </h1>
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-800">Profile</p>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full cb-dashboard-shimmer-bar transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-bold text-slate-800">{completionPercent}%</span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/profile')}
              className="w-full max-w-md rounded-xl border-slate-200 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Complete Profile
            </Button>
          </div>
        </section>

        {/* Recommended Jobs — 5 cards in one horizontal row + See all */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">Recommended Jobs</h2>
          </div>
          <div className="cb-dashboard-jobs-row -mx-1 px-1">
            {displayJobs.map((job) => (
              <div key={job.id} className="cb-dashboard-job-slot">
                <RecommendedJobCard
                  job={job}
                  cityFallback={city}
                  onView={() => router.push(`/jobs/${job.id}`)}
                  onApply={() => router.push(`/jobs/${job.id}`)}
                />
              </div>
            ))}
            <div className="cb-dashboard-job-slot">
              <SeeAllJobsCard onClick={() => router.push('/jobs')} />
            </div>
          </div>
        </section>

        {/* Upcoming Interview */}
        <UpcomingInterviewSection onView={() => router.push('/interviews')} />
      </div>
    </CandidateAppShell>
  );
}
